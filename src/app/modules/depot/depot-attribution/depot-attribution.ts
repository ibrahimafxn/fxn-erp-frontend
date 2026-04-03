import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { MaterialService } from '../../../core/services/material.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { AttributionService } from '../../../core/services/attribution.service';
import { Material, Consumable, User } from '../../../core/models';
import { formatPersonName, formatResourceName } from '../../../core/utils/text-format';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

type ResourceType = 'MATERIAL' | 'CONSUMABLE';

@Component({
  selector: 'app-depot-attribution',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './depot-attribution.html',
  styleUrls: ['./depot-attribution.scss']
})
export class DepotAttribution {
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private materialService = inject(MaterialService);
  private consumableService = inject(ConsumableService);
  private attributionService = inject(AttributionService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  readonly technicians = signal<User[]>([]);
  readonly materials = signal<Material[]>([]);
  readonly consumables = signal<Consumable[]>([]);
  readonly techniciansLoading = signal(false);
  readonly resourcesLoading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly confirmOpen = signal(false);

  readonly depotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) return String((raw as { _id: string })._id);
    return null;
  });

  readonly form = this.fb.nonNullable.group({
    technicianId: this.fb.nonNullable.control('', [Validators.required]),
    globalNote: this.fb.nonNullable.control(''),
    lines: this.fb.nonNullable.array([this.buildLine()])
  });

  readonly selectedTechLabel = computed(() => {
    const id = this.form.controls.technicianId.value;
    const tech = this.technicians().find((t) => t._id === id);
    return tech ? this.techLabel(tech) : '';
  });

  constructor() {
    effect(() => {
      const depotId = this.depotId();
      if (!depotId) return;
      this.loadTechnicians(depotId);
      this.refreshResources('MATERIAL', depotId);
      this.refreshResources('CONSUMABLE', depotId);
    });
  }

  get lines(): FormArray {
    return this.form.controls.lines;
  }

  lineAt(index: number) {
    return this.lines.at(index);
  }

  addLine(): void {
    this.lines.push(this.buildLine());
  }

  removeLine(index: number): void {
    if (this.lines.length <= 1) return;
    this.lines.removeAt(index);
  }

  resetForm(): void {
    this.form.reset({
      technicianId: '',
      globalNote: '',
      lines: []
    });
    this.lines.clear();
    this.lines.push(this.buildLine());
    this.error.set(null);
    this.success.set(null);
  }

  openConfirm(): void {
    this.error.set(null);
    this.success.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Complète tous les champs obligatoires.');
      return;
    }
    this.confirmOpen.set(true);
  }

  closeConfirm(): void {
    if (this.submitting()) return;
    this.confirmOpen.set(false);
  }

  submit(): void {
    if (this.submitting()) return;
    const depotId = this.depotId();
    if (!depotId) {
      this.error.set('Utilisateur sans dépôt associé.');
      this.confirmOpen.set(false);
      return;
    }
    const payload = this.form.getRawValue();
    const globalNote = String(payload.globalNote || '').trim();
    const lines = payload.lines
      .map((line) => ({
        resourceId: line.resourceId,
        resourceType: line.resourceType,
        quantity: Number(line.quantity || 0),
        note: String(line.note || '').trim()
      }))
      .filter((line) => line.resourceId && line.quantity > 0 && line.resourceType);

    if (!lines.length) {
      this.error.set('Ajoute au moins une ligne valide.');
      this.confirmOpen.set(false);
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    const requests = lines.map((line) => this.attributionService.createAttribution({
      resourceType: line.resourceType,
      resourceId: line.resourceId,
      quantity: line.quantity,
      fromDepot: depotId,
      toUser: payload.technicianId,
      action: 'ATTRIBUTION',
      note: this.composeNote(globalNote, line.note)
    }));

    forkJoin(requests).subscribe({
      next: () => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.success.set('Attribution enregistrée.');
        this.form.reset({
          technicianId: payload.technicianId,
          globalNote: '',
          lines: []
        });
        this.lines.clear();
        this.lines.push(this.buildLine());
        const depotId = this.depotId();
        if (depotId) {
          this.refreshResources('MATERIAL', depotId);
          this.refreshResources('CONSUMABLE', depotId);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.error.set(err?.error?.message || 'Erreur attribution');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/depot']).then();
  }

  resourceLabel(item: Material | Consumable): string {
    const qty = this.availableQty(item);
    if ('unit' in item) {
      return `${formatResourceName(item.name)} · ${item.unit} · dispo ${qty}`;
    }
    return `${formatResourceName(item.name)} · dispo ${qty}`;
  }

  techLabel(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || u._id;
  }

  private buildLine() {
    return this.fb.nonNullable.group({
      resourceType: this.fb.nonNullable.control<ResourceType>('CONSUMABLE'),
      resourceId: this.fb.nonNullable.control('', [Validators.required]),
      quantity: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
      note: this.fb.nonNullable.control('')
    });
  }

  private composeNote(globalNote: string, lineNote: string): string {
    if (globalNote && lineNote) return `${globalNote} - ${lineNote}`;
    return globalNote || lineNote || '';
  }

  private loadTechnicians(depotId: string): void {
    this.techniciansLoading.set(true);
    this.userService.refreshUsers(true, { role: 'TECHNICIEN', depot: depotId, page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.technicians.set(res.items ?? []);
        this.techniciansLoading.set(false);
      },
      error: () => this.techniciansLoading.set(false)
    });
  }

  private refreshResources(type: ResourceType, depotId: string): void {
    this.resourcesLoading.set(true);
    if (type === 'MATERIAL') {
      this.materials.set([]);
      this.materialService.refresh(true, { depot: depotId, page: 1, limit: 200 }).subscribe({
        next: (res) => {
          this.materials.set(res.items ?? []);
          this.resourcesLoading.set(false);
        },
        error: () => this.resourcesLoading.set(false)
      });
      return;
    }

    this.consumables.set([]);
    this.consumableService.refresh(true, { depot: depotId, page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.consumables.set(res.items ?? []);
        this.resourcesLoading.set(false);
      },
      error: () => this.resourcesLoading.set(false)
    });
  }

  private availableQty(item: Material | Consumable): number {
    const total = item.quantity ?? 0;
    const assigned = (item as unknown as { assignedQuantity?: number }).assignedQuantity ?? 0;
    return Math.max(0, total - assigned);
  }

  resourceOptionsFor(type: ResourceType): Array<Material | Consumable> {
    return type === 'MATERIAL' ? this.materials() : this.consumables();
  }
}
