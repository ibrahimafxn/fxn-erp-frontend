import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { MovementService } from '../../../core/services/movement.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { MaterialService } from '../../../core/services/material.service';
import { Consumable, Material, Movement } from '../../../core/models';
import { apiError } from '../../../core/utils/http-error';
import { resolveStockFamily } from '../../../core/utils/stock-family';

type ConsumptionRow = {
  technician: string;
  totalQty: number;
  movementCount: number;
  ptoQty: number;
  jarretiereQty: number;
  boitierQty: number;
  cableQty: number;
  connectiqueQty: number;
  outilQty: number;
  epiQty: number;
  otherQty: number;
  materialQty: number;
  consumableQty: number;
  topResources: string[];
};

@Component({
  selector: 'app-material-consumption',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  templateUrl: './material-consumption.html',
  styleUrl: './material-consumption.scss'
})
export class MaterialConsumption {
  private movementService = inject(MovementService);
  private materialService = inject(MaterialService);
  private consumableService = inject(ConsumableService);
  private fb = inject(FormBuilder);
  private datePipe = inject(DatePipe);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<ConsumptionRow[]>([]);

  readonly filterForm = this.fb.nonNullable.group({
    fromDate: this.fb.nonNullable.control(this.firstDayOfCurrentMonth()),
    toDate: this.fb.nonNullable.control(this.lastDayOfCurrentMonth()),
    resourceType: this.fb.nonNullable.control<'ALL' | 'MATERIAL' | 'CONSUMABLE'>('ALL')
  });

  readonly totals = computed(() => {
    const rows = this.rows();
    return rows.reduce((acc, row) => ({
      totalQty: acc.totalQty + row.totalQty,
      movementCount: acc.movementCount + row.movementCount,
      technicianCount: acc.technicianCount + 1,
      ptoQty: acc.ptoQty + row.ptoQty,
      jarretiereQty: acc.jarretiereQty + row.jarretiereQty,
      boitierQty: acc.boitierQty + row.boitierQty,
      cableQty: acc.cableQty + row.cableQty,
      connectiqueQty: acc.connectiqueQty + row.connectiqueQty,
      outilQty: acc.outilQty + row.outilQty,
      epiQty: acc.epiQty + row.epiQty
    }), {
      totalQty: 0,
      movementCount: 0,
      technicianCount: 0,
      ptoQty: 0,
      jarretiereQty: 0,
      boitierQty: 0,
      cableQty: 0,
      connectiqueQty: 0,
      outilQty: 0,
      epiQty: 0
    });
  });

  readonly topConsumer = computed(() => this.rows()[0] || null);

  constructor() {
    this.load();
  }

  load(): void {
    const filters = this.filterForm.getRawValue();
    const requests = [];

    if (filters.resourceType === 'ALL' || filters.resourceType === 'CONSUMABLE') {
      requests.push(this.movementService.listRaw({
        resourceType: 'CONSUMABLE',
        action: 'ASSIGN',
        toType: 'USER',
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        page: 1,
        limit: 1000
      }));
    }

    if (filters.resourceType === 'ALL' || filters.resourceType === 'MATERIAL') {
      requests.push(this.movementService.listRaw({
        resourceType: 'MATERIAL',
        action: 'ASSIGN',
        toType: 'USER',
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        page: 1,
        limit: 1000
      }));
    }

    requests.push(this.materialService.refresh(true, { page: 1, limit: 1000 }));
    requests.push(this.consumableService.refresh(true, { page: 1, limit: 1000 }));

    this.loading.set(true);
    this.error.set(null);

    forkJoin(requests).subscribe({
      next: (results) => {
        const materialCatalog = (results[results.length - 2] as { items?: Material[] })?.items ?? [];
        const consumableCatalog = (results[results.length - 1] as { items?: Consumable[] })?.items ?? [];
        const movementResults = results.slice(0, -2) as Array<{ items?: Movement[] }>;
        const items = movementResults.flatMap((result) => result.items ?? []);
        this.rows.set(this.buildRows(items, materialCatalog, consumableCatalog));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiError(err, 'Erreur chargement gestion materiel'));
        this.loading.set(false);
      }
    });
  }

  clearFilters(): void {
    this.filterForm.setValue({
      fromDate: this.firstDayOfCurrentMonth(),
      toDate: this.lastDayOfCurrentMonth(),
      resourceType: 'ALL'
    });
    this.load();
  }

  formatPeriod(): string {
    const { fromDate, toDate } = this.filterForm.getRawValue();
    const from = fromDate ? this.datePipe.transform(fromDate, 'dd/MM/yyyy') : '—';
    const to = toDate ? this.datePipe.transform(toDate, 'dd/MM/yyyy') : '—';
    return `${from} AU ${to}`;
  }

  trackRow(index: number, row: ConsumptionRow): string {
    return `${row.technician}-${index}`;
  }

  shareOfTop(row: ConsumptionRow): number {
    const max = this.topConsumer()?.totalQty || 0;
    if (!max) return 0;
    return Math.round((row.totalQty / max) * 100);
  }

  private buildRows(items: Movement[], materials: Material[], consumables: Consumable[]): ConsumptionRow[] {
    const materialById = new Map(materials.map((item) => [item._id, item]));
    const consumableById = new Map(consumables.map((item) => [item._id, item]));

    const byTechnician = new Map<string, {
      totalQty: number;
      movementCount: number;
      ptoQty: number;
      jarretiereQty: number;
      boitierQty: number;
      cableQty: number;
      connectiqueQty: number;
      outilQty: number;
      epiQty: number;
      otherQty: number;
      materialQty: number;
      consumableQty: number;
      resourceCounts: Map<string, number>;
    }>();

    for (const item of items) {
      const linkedMaterial = item.resourceType === 'MATERIAL' ? materialById.get(item.resourceId) : null;
      const linkedConsumable = item.resourceType === 'CONSUMABLE' ? consumableById.get(item.resourceId) : null;
      const technician = String(item.toLabel || item.authorName || item.to?.id || '').trim() || 'TECHNICIEN NON RENSEIGNE';
      const qty = Math.max(0, Number(item.quantity || 0));
      const resourceLabel = String(
        linkedMaterial?.name
          || linkedConsumable?.name
          || item.resourceLabel
          || item.resourceId
          || 'RESSOURCE'
      ).trim();

      const current = byTechnician.get(technician) || {
        totalQty: 0,
        movementCount: 0,
        ptoQty: 0,
        jarretiereQty: 0,
        boitierQty: 0,
        cableQty: 0,
        connectiqueQty: 0,
        outilQty: 0,
        epiQty: 0,
        otherQty: 0,
        materialQty: 0,
        consumableQty: 0,
        resourceCounts: new Map<string, number>()
      };

      current.totalQty += qty;
      current.movementCount += 1;
      current.resourceCounts.set(resourceLabel, (current.resourceCounts.get(resourceLabel) || 0) + qty);

      if (item.resourceType === 'MATERIAL') current.materialQty += qty;
      if (item.resourceType === 'CONSUMABLE') current.consumableQty += qty;

      switch (resolveStockFamily({
        label: resourceLabel,
        category: linkedMaterial?.category ? String(linkedMaterial.category) : null
      })) {
        case 'PTO':
          current.ptoQty += qty;
          break;
        case 'JARRETIERE':
          current.jarretiereQty += qty;
          break;
        case 'BOITIER':
          current.boitierQty += qty;
          break;
        case 'CABLE':
          current.cableQty += qty;
          break;
        case 'CONNECTIQUE':
          current.connectiqueQty += qty;
          break;
        case 'OUTIL':
          current.outilQty += qty;
          break;
        case 'EPI':
          current.epiQty += qty;
          break;
        default:
          current.otherQty += qty;
          break;
      }

      byTechnician.set(technician, current);
    }

    return [...byTechnician.entries()]
      .map(([technician, value]) => ({
        technician,
        totalQty: value.totalQty,
        movementCount: value.movementCount,
        ptoQty: value.ptoQty,
        jarretiereQty: value.jarretiereQty,
        boitierQty: value.boitierQty,
        cableQty: value.cableQty,
        connectiqueQty: value.connectiqueQty,
        outilQty: value.outilQty,
        epiQty: value.epiQty,
        otherQty: value.otherQty,
        materialQty: value.materialQty,
        consumableQty: value.consumableQty,
        topResources: [...value.resourceCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label, quantity]) => `${label} (${quantity})`)
      }))
      .sort((a, b) => {
        const qtyDiff = b.totalQty - a.totalQty;
        if (qtyDiff !== 0) return qtyDiff;
        return b.movementCount - a.movementCount;
      });
  }

  private firstDayOfCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private lastDayOfCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
}
