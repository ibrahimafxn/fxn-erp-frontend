import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { DepotService } from '../../../core/services/depot.service';
import { ReceiptService, ReceiptLine } from '../../../core/services/receipt.service';
import { MovementService } from '../../../core/services/movement.service';
import { MaterialService } from '../../../core/services/material.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { ResourceListService, ResourceListItem } from '../../../core/services/resource-list.service';
import { AuthService } from '../../../core/services/auth.service';
import { Consumable, Depot, Material, Movement, MovementListResult } from '../../../core/models';
import { Role } from '../../../core/models/roles.model';
import { formatDepotName, formatResourceName } from '../../../core/utils/text-format';
import { downloadBlob } from '../../../core/utils/download';

type LineForm = {
  resourceType: 'CONSUMABLE' | 'MATERIAL';
  resourceId: string;
  quantity: number;
};

@Component({
  selector: 'app-receipt-page',
  standalone: true,
  providers: [DatePipe],
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './receipt-page.html',
  styleUrl: './receipt-page.scss'
})
export class ReceiptPage {
  private fb = inject(FormBuilder);
  private depotService = inject(DepotService);
  private receiptService = inject(ReceiptService);
  private movementService = inject(MovementService);
  private materialService = inject(MaterialService);
  private consumableService = inject(ConsumableService);
  private resourceListService = inject(ResourceListService);
  private auth = inject(AuthService);
  private datePipe = inject(DatePipe);

  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);
  readonly materials = signal<Material[]>([]);
  readonly consumables = signal<Consumable[]>([]);
  readonly resources = signal<ResourceListItem[]>([]);
  readonly resourcesLoading = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);

  readonly historyLoading = this.movementService.loading;
  readonly historyError = this.movementService.error;
  readonly historyResult = this.movementService.result;
  readonly historyPage = signal(1);
  readonly historyLimit = signal(25);

  readonly historyItems = computed<Movement[]>(() => this.historyResult()?.items ?? []);
  readonly historyTotal = computed(() => this.historyResult()?.total ?? 0);
  readonly historyPageCount = computed(() => {
    const t = this.historyTotal();
    const l = this.historyLimit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.historyPage() > 1);
  readonly canNext = computed(() => this.historyPage() < this.historyPageCount());

  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly managerDepotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) return String((raw as { _id: string })._id);
    return null;
  });

  readonly filterForm = this.fb.nonNullable.group({
    resourceType: this.fb.nonNullable.control(''),
    resourceName: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly form = this.fb.nonNullable.group({
    depotId: this.fb.nonNullable.control('', [Validators.required]),
    supplier: this.fb.nonNullable.control(''),
    reference: this.fb.nonNullable.control(''),
    note: this.fb.nonNullable.control(''),
    lines: this.fb.array([])
  });

  readonly lines = computed(() => this.form.controls.lines as FormArray);
  readonly showDepotFilter = computed(() => !this.isDepotManager());

  constructor() {
    if (this.isDepotManager()) {
      const depotId = this.managerDepotId();
      if (depotId) this.form.controls.depotId.setValue(depotId);
    }
    this.addLine();
    this.loadDepots();
    this.loadResources(this.isDepotManager() ? this.managerDepotId() : null);
    this.form.controls.depotId.valueChanges.subscribe((depotId) => {
      if (this.isDepotManager()) return;
      this.loadResources(depotId || null);
    });
    this.refreshHistory(true);
  }

  addLine(): void {
    const line = this.fb.nonNullable.group({
      resourceType: this.fb.nonNullable.control<LineForm['resourceType']>('CONSUMABLE'),
      resourceId: this.fb.nonNullable.control('', [Validators.required]),
      quantity: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)])
    });

    this.lines().push(line);
  }

  removeLine(index: number): void {
    if (this.lines().length <= 1) return;
    this.lines().removeAt(index);
  }

  lineGroup(index: number): FormGroup {
    return this.lines().at(index) as FormGroup;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const depotId = this.form.controls.depotId.value;
    if (!depotId) {
      this.submitError.set('Dépôt requis.');
      return;
    }

    const lines = (this.lines().getRawValue() as LineForm[])
      .filter((line) => line.resourceId && line.quantity > 0)
      .map((line) => {
        const qty = Number(line.quantity);
        if (line.resourceType === 'CONSUMABLE') {
          const c = this.resources().find((item) => item._id === line.resourceId && item.type === 'CONSUMABLE');
          if (!c) throw new Error('Consommable introuvable dans la liste');
          return {
            resourceType: 'CONSUMABLE',
            name: c.name,
            quantity: qty,
            unit: c.unit || 'pcs',
            minQuantity: typeof c.minQuantity === 'number' ? c.minQuantity : 0
          };
        }
        const m = this.resources().find((item) => item._id === line.resourceId && item.type === 'MATERIAL');
        if (!m) throw new Error('Matériel introuvable dans la liste');
        return {
          resourceType: 'MATERIAL',
          name: m.name,
          quantity: qty,
          category: m.category === 'EPI' ? 'EPI' : 'Outil'
        };
      }) as ReceiptLine[];

    if (lines.length === 0) {
      this.submitError.set('Ajoute au moins une ligne valide.');
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(null);

    try {
      this.receiptService.createReceipt({
        depotId,
        supplier: this.form.controls.supplier.value.trim(),
        reference: this.form.controls.reference.value.trim(),
        note: this.form.controls.note.value.trim(),
        lines
      }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitSuccess.set('Réception enregistrée.');
          this.form.controls.supplier.reset('');
          this.form.controls.reference.reset('');
          this.form.controls.note.reset('');
          this.lines().clear();
          this.addLine();
          this.refreshHistory(true);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.submitError.set(this.apiError(err, 'Erreur réception commande'));
        }
      });
    } catch (err) {
      this.submitting.set(false);
      this.submitError.set(err instanceof Error ? err.message : 'Erreur réception commande');
    }
  }

  refreshHistory(force = false): void {
    const f = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(f.fromDate, f.toDate);
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);

    this.loadResources(depotId || null);
    this.movementService.refresh(force, {
      resourceType: f.resourceType || undefined,
      resourceName: f.resourceName.trim() || undefined,
      action: 'IN',
      reason: 'RECEPTION_COMMANDE',
      depotId: depotId || undefined,
      fromDate: dates.fromDate,
      toDate: dates.toDate,
      page: this.historyPage(),
      limit: this.historyLimit()
    }).subscribe({ error: () => {} });
  }

  exportCsv(): void {
    const f = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(f.fromDate, f.toDate);
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);

    this.movementService.exportCsv({
      resourceType: f.resourceType || undefined,
      resourceName: f.resourceName.trim() || undefined,
      action: 'IN',
      reason: 'RECEPTION_COMMANDE',
      depotId: depotId || undefined,
      fromDate: dates.fromDate,
      toDate: dates.toDate
    }).subscribe({
      next: (blob) => downloadBlob(blob, `receptions-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => {}
    });
  }

  exportPdf(): void {
    const f = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(f.fromDate, f.toDate);
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);

    this.movementService.exportPdf({
      resourceType: f.resourceType || undefined,
      resourceName: f.resourceName.trim() || undefined,
      action: 'IN',
      reason: 'RECEPTION_COMMANDE',
      depotId: depotId || undefined,
      fromDate: dates.fromDate,
      toDate: dates.toDate
    }).subscribe({
      next: (blob) => downloadBlob(blob, `receptions-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => {}
    });
  }

  searchHistory(): void {
    this.historyPage.set(1);
    this.refreshHistory(true);
  }

  clearHistory(): void {
    this.filterForm.setValue({
      resourceType: '',
      resourceName: '',
      depot: '',
      fromDate: '',
      toDate: ''
    });
    this.historyPage.set(1);
    this.refreshHistory(true);
  }

  prevHistory(): void {
    if (!this.canPrev()) return;
    this.historyPage.set(this.historyPage() - 1);
    this.refreshHistory(true);
  }

  nextHistory(): void {
    if (!this.canNext()) return;
    this.historyPage.set(this.historyPage() + 1);
    this.refreshHistory(true);
  }

  setHistoryLimit(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.historyLimit.set(v);
    this.historyPage.set(1);
    this.refreshHistory(true);
  }

  depotLabelById(id?: string | null): string {
    if (!id) return '—';
    const depot = this.depots().find((d) => d._id === id);
    if (!depot) return id;
    return formatDepotName(depot.name ?? '') || depot.name || id;
  }

  movementResourceLabel(m: Movement): string {
    const id = m.resourceId;
    if (m.resourceType === 'CONSUMABLE') {
      const con = this.consumables().find((c) => c._id === id);
      return con?.name || id;
    }
    if (m.resourceType === 'MATERIAL') {
      const mat = this.materials().find((c) => c._id === id);
      return mat?.name || id;
    }
    return id || m.resourceType;
  }

  createdAtText(m: Movement): string {
    return this.datePipe.transform(m.createdAt as any, 'short') ?? '—';
  }

  private loadDepots(): void {
    if (this.isDepotManager()) return;
    this.depotsLoading.set(true);
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false)
    });
  }

  resourceOptions(type: LineForm['resourceType']): Array<{ _id: string; label: string }> {
    if (type === 'MATERIAL') {
      return this.materials().map((m) => ({
        _id: m._id,
        label: formatResourceName(m.name ?? '') || m._id
      }));
    }
    return this.consumables().map((c) => ({
      _id: c._id,
      label: `${formatResourceName(c.name ?? '') || c._id}${c.unit ? ' · ' + c.unit : ''}`
    }));
  }

  private loadResources(depotId: string | null): void {
    this.resourcesLoading.set(true);

    this.resourceListService.refresh().subscribe({
      next: (res) => {
        this.resources.set(res.data ?? []);
        const filtered = depotId
          ? this.resources().filter((item) => String(item.idDepot || '') === String(depotId))
          : this.resources();
        this.materials.set(filtered.filter((item) => item.type === 'MATERIAL') as unknown as Material[]);
        this.consumables.set(filtered.filter((item) => item.type === 'CONSUMABLE') as unknown as Consumable[]);
        this.resourcesLoading.set(false);
      },
      error: () => {
        this.resourcesLoading.set(false);
      }
    });
  }

  private normalizeDateRange(fromDate: string, toDate: string): { fromDate?: string; toDate?: string } {
    const from = fromDate ? `${fromDate}T00:00:00` : '';
    const to = toDate ? `${toDate}T23:59:59.999` : '';
    return {
      fromDate: from || undefined,
      toDate: to || undefined
    };
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
