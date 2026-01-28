import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { DepotService } from '../../../core/services/depot.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { MaterialService } from '../../../core/services/material.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { AttributionService } from '../../../core/services/attribution.service';
import { formatPersonName, formatResourceName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

import { DepotStats, Material, Consumable, User } from '../../../core/models';

type ResourceType = 'MATERIAL' | 'CONSUMABLE';
type AttributionItem = {
  _id: string;
  resourceType: 'MATERIAL' | 'CONSUMABLE' | 'VEHICLE';
  resourceId: string | {
    _id: string;
    name?: string;
    unit?: string;
    brand?: string;
    model?: string;
    plateNumber?: string;
  };
  quantity?: number;
  action?: string;
  note?: string;
  createdAt?: string | Date;
};

@Component({
  selector: 'app-depot-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  templateUrl: './depot-dashboard.html',
  styleUrls: ['./depot-dashboard.scss'],
  imports: [CommonModule, ReactiveFormsModule],
})
export class DepotDashboard {
  private depotService = inject(DepotService);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private materialService = inject(MaterialService);
  private consumableService = inject(ConsumableService);
  private attributionService = inject(AttributionService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly stats = signal<DepotStats | null>(null);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly assigning = signal(false);
  readonly assignError = signal<string | null>(null);
  readonly assignSuccess = signal<string | null>(null);

  readonly materials = signal<Material[]>([]);
  readonly consumables = signal<Consumable[]>([]);
  readonly technicians = signal<User[]>([]);
  readonly resourcesLoading = signal(false);
  readonly techniciansLoading = signal(false);
  readonly techAttributions = signal<AttributionItem[]>([]);
  readonly techAttributionsLoading = signal(false);
  readonly techAttributionsError = signal<string | null>(null);
  readonly selectedTechViewId = signal<string>('');
  readonly techAttributionsPage = signal(1);
  readonly techAttributionsLimit = signal(10);
  readonly techAttributionsTotal = signal(0);
  readonly pageRange = formatPageRange;
  readonly techAttributionsPageCount = computed(() => {
    const t = this.techAttributionsTotal();
    const l = this.techAttributionsLimit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrevTechAttributions = computed(() => this.techAttributionsPage() > 1);
  readonly canNextTechAttributions = computed(() => this.techAttributionsPage() < this.techAttributionsPageCount());

  readonly selectedResourceType = signal<ResourceType>('CONSUMABLE');

  readonly lowStockTotal = computed(() => {
    const s = this.stats();
    if (!s) return 0;
    return (s.lowStockConsumables ?? 0) + (s.lowStockMaterials ?? 0) + (s.vehicleAlerts ?? 0);
  });

  readonly depotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) {
      return String((raw as { _id: string })._id);
    }
    return null;
  });

  readonly assignForm = this.fb.nonNullable.group({
    resourceType: this.fb.nonNullable.control<ResourceType>('CONSUMABLE'),
    resourceId: this.fb.nonNullable.control('', [Validators.required]),
    quantity: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
    techId: this.fb.nonNullable.control('', [Validators.required]),
    note: this.fb.nonNullable.control(''),
  });

  readonly resourceOptions = computed(() => {
    return this.selectedResourceType() === 'MATERIAL'
      ? this.materials()
      : this.consumables();
  });

  readonly techResourceSummary = computed(() => {
    const items = this.techAttributions();
    const summary = new Map<string, { label: string; qty: number; type: string }>();

    for (const item of items) {
      if (!item || !item.resourceType || !item.resourceId) continue;
      const qty = Number(item.quantity ?? 1);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      if (item.action !== 'ATTRIBUTION' && item.action !== 'REPRISE') continue;
      const sign = item.action === 'REPRISE' ? -1 : 1;

      const id = typeof item.resourceId === 'string' ? item.resourceId : item.resourceId._id;
      const key = `${item.resourceType}:${id}`;
      const label = this.resourceLabelFromAttribution(item);
      const current = summary.get(key) ?? { label, qty: 0, type: item.resourceType };
      summary.set(key, { ...current, qty: current.qty + (qty * sign) });
    }

    return Array.from(summary.values()).filter(item => item.qty > 0);
  });

  constructor() {
    effect(() => {
      const depotId = this.depotId();
      if (!depotId) return;
      this.loadStats();
      this.loadResources();
      this.loadTechnicians();
    });

    this.assignForm.controls.resourceType.valueChanges.subscribe((type) => {
      this.selectedResourceType.set(type);
      this.assignForm.controls.resourceId.setValue('');
      this.assignSuccess.set(null);
      this.assignError.set(null);
      this.refreshResourcesFor(type);
    });
  }

  private loadStats(): void {
    const depotId = this.depotId();
    if (!depotId) {
      this.error.set('Utilisateur sans dépôt associé.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.depotService.getDepotStats(depotId).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement dépôt');
      },
    });
  }

  private loadResources(): void {
    const depotId = this.depotId();
    if (!depotId) return;

    this.refreshResourcesFor(this.selectedResourceType());
  }

  private refreshResourcesFor(type: ResourceType): void {
    const depotId = this.depotId();
    if (!depotId) return;

    this.resourcesLoading.set(true);
    if (type === 'MATERIAL') {
      this.materials.set([]);
      this.materialService.refresh(true, { depot: depotId, page: 1, limit: 200 }).subscribe({
        next: (res) => {
          this.materials.set(res.items ?? []);
          this.resourcesLoading.set(false);
        },
        error: () => this.resourcesLoading.set(false),
      });
      return;
    }

    this.consumables.set([]);
    this.consumableService.refresh(true, { depot: depotId, page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.consumables.set(res.items ?? []);
        this.resourcesLoading.set(false);
      },
      error: () => this.resourcesLoading.set(false),
    });
  }

  private loadTechnicians(): void {
    const depotId = this.depotId();
    if (!depotId) return;

    this.techniciansLoading.set(true);
    this.userService.refreshUsers(true, { role: 'TECHNICIEN', depot: depotId, page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.technicians.set(res.items ?? []);
        this.techniciansLoading.set(false);
      },
      error: () => this.techniciansLoading.set(false),
    });
  }

  refresh(): void {
    this.loadStats();
    this.loadResources();
    this.loadTechnicians();
  }

  goMaterials(): void {
    this.router.navigate(['/depot/resources/materials']).then();
  }

  goConsumables(): void {
    this.router.navigate(['/depot/resources/consumables']).then();
  }

  goVehicles(): void {
    this.router.navigate(['/depot/resources/vehicles']).then();
  }

  goHistory(): void {
    this.router.navigate(['/depot/history']).then();
  }

  goStockAlerts(): void {
    this.router.navigate(['/depot/alerts/stock']).then();
  }

  resourceLabel(item: Material | Consumable): string {
    const qty = this.availableQty(item);
    if ('unit' in item) {
      return `${formatResourceName(item.name)} · ${item.unit} · dispo ${qty}`;
    }
    return `${formatResourceName(item.name)} · dispo ${qty}`;
  }

  availableQty(item: Material | Consumable): number {
    const total = item.quantity ?? 0;
    const assigned = (item as unknown as { assignedQuantity?: number }).assignedQuantity ?? 0;
    return Math.max(0, total - assigned);
  }

  techLabel(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || u._id;
  }

  onTechViewSelect(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const id = el.value || '';
    this.selectedTechViewId.set(id);
    this.techAttributionsPage.set(1);
    if (!id) {
      this.techAttributions.set([]);
      this.techAttributionsTotal.set(0);
      this.techAttributionsError.set(null);
      return;
    }
    this.loadTechAttributions(id);
  }

  actionLabel(action?: string): string {
    switch (action) {
      case 'ATTRIBUTION': return 'Attribution';
      case 'REPRISE': return 'Reprise';
      default: return action || '—';
    }
  }

  attributionResourceLabel(item: AttributionItem): string {
    const label = this.resourceLabelFromAttribution(item);
    return label || '—';
  }

  private loadTechAttributions(techId: string): void {
    this.techAttributionsLoading.set(true);
    this.techAttributionsError.set(null);
    this.attributionService.listAttributions({
      toUser: techId,
      page: this.techAttributionsPage(),
      limit: this.techAttributionsLimit(),
    }, { silent: false }).subscribe({
      next: (res) => {
        this.techAttributions.set(res.items ?? []);
        this.techAttributionsTotal.set(res.total ?? 0);
        this.techAttributionsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.techAttributionsLoading.set(false);
        this.techAttributionsError.set(err?.error?.message || 'Erreur chargement attributions');
      },
    });
  }

  prevTechAttributions(): void {
    if (!this.canPrevTechAttributions()) return;
    this.techAttributionsPage.set(this.techAttributionsPage() - 1);
    const techId = this.selectedTechViewId();
    if (techId) this.loadTechAttributions(techId);
  }

  nextTechAttributions(): void {
    if (!this.canNextTechAttributions()) return;
    this.techAttributionsPage.set(this.techAttributionsPage() + 1);
    const techId = this.selectedTechViewId();
    if (techId) this.loadTechAttributions(techId);
  }

  setTechAttributionsLimit(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.setTechAttributionsLimitValue(v);
  }

  setTechAttributionsLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.techAttributionsLimit.set(value);
    this.techAttributionsPage.set(1);
    const techId = this.selectedTechViewId();
    if (techId) this.loadTechAttributions(techId);
  }

  private resourceLabelFromAttribution(item: AttributionItem): string {
    const res = item.resourceId;
    if (typeof res === 'object' && res) {
      if (item.resourceType === 'VEHICLE') {
        const title = `${res.brand ?? ''} ${res.model ?? ''}`.trim();
        return title || res.plateNumber || res._id;
      }
      const unit = res.unit ? ` · ${res.unit}` : '';
      return `${formatResourceName(res.name ?? '') || res._id}${unit}`;
    }

    return String(res ?? '—');
  }

  submitAssign(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      return;
    }

    const depotId = this.depotId();
    if (!depotId) {
      this.assignError.set('Aucun dépôt associé.');
      return;
    }

    this.assigning.set(true);
    this.assignError.set(null);
    this.assignSuccess.set(null);

    const raw = this.assignForm.getRawValue();
    const selected = this.resourceOptions().find((r) => r._id === raw.resourceId);
    if (!selected) {
      this.assigning.set(false);
      this.assignError.set('Ressource introuvable.');
      return;
    }

    const available = this.availableQty(selected);
    if (raw.quantity > available) {
      this.assigning.set(false);
      this.assignError.set(`Stock insuffisant (disponible : ${available}).`);
      return;
    }

    this.attributionService.createAttribution({
      resourceType: raw.resourceType,
      resourceId: raw.resourceId,
      quantity: raw.quantity,
      fromDepot: depotId,
      toUser: raw.techId,
      action: 'ATTRIBUTION',
      note: raw.note?.trim() || undefined
    }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assignSuccess.set('Attribution enregistrée.');
        this.assignForm.patchValue({ resourceId: '', quantity: 1, techId: '', note: '' });
        this.loadResources();
      },
      error: (err: HttpErrorResponse) => {
        this.assigning.set(false);
        this.assignError.set(err?.error?.message || 'Erreur attribution');
      },
    });
  }
}
