import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MovementService } from '../../../core/services/movement.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { MaterialService } from '../../../core/services/material.service';
import { Consumable, Material, Movement } from '../../../core/models';
import { apiError } from '../../../core/utils/http-error';

type ResourceCount = {
  label: string;
  quantity: number;
};

type ResourceSummary = {
  label: string;
  quantity: number;
  technicianCount: number;
  movementCount: number;
};

type ConsumptionRow = {
  technician: string;
  totalQty: number;
  movementCount: number;
  topResources: ResourceCount[];
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
  readonly resourceInsights = signal<ResourceSummary[]>([]);

  readonly filterForm = this.fb.nonNullable.group({
    fromDate: this.fb.nonNullable.control(this.firstDayOfCurrentMonth()),
    toDate: this.fb.nonNullable.control(this.lastDayOfCurrentMonth()),
    resourceType: this.fb.nonNullable.control<'ALL' | 'MATERIAL' | 'CONSUMABLE'>('ALL')
  });

  readonly totals = computed(() => {
    const rows = this.rows();
    const resourceCount = this.resourceInsights().length;
    return rows.reduce((acc, row) => ({
      totalQty: acc.totalQty + row.totalQty,
      movementCount: acc.movementCount + row.movementCount,
      technicianCount: acc.technicianCount + 1,
      resourceCount
    }), {
      totalQty: 0,
      movementCount: 0,
      technicianCount: 0,
      resourceCount
    });
  });

  readonly resourceSummary = computed(() => {
    const resources = this.resourceInsights();
    return {
      resourceCount: resources.length,
      topResources: resources.slice(0, 6),
      topResource: resources[0] ?? null
    };
  });

  readonly topConsumer = computed(() => this.rows()[0] || null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const filters = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    try {
      const [movementGroups, materialCatalog, consumableCatalog] = await Promise.all([
        this.loadMonthlyMovements(filters.fromDate || undefined, filters.toDate || undefined, filters.resourceType),
        firstValueFrom(this.materialService.refresh(true, { page: 1, limit: 1000 })),
        firstValueFrom(this.consumableService.refresh(true, { page: 1, limit: 1000 }))
      ]);

      const movements = movementGroups.flat();
      this.rows.set(this.buildRows(
        movements,
        materialCatalog.items ?? [],
        consumableCatalog.items ?? []
      ));
      this.resourceInsights.set(this.buildResourceInsights(
        movements,
        materialCatalog.items ?? [],
        consumableCatalog.items ?? []
      ));
    } catch (err) {
      this.rows.set([]);
      this.resourceInsights.set([]);
      this.error.set(apiError(err, 'Erreur chargement gestion materiel'));
    } finally {
      this.loading.set(false);
    }
  }

  clearFilters(): void {
    this.filterForm.setValue({
      fromDate: this.firstDayOfCurrentMonth(),
      toDate: this.lastDayOfCurrentMonth(),
      resourceType: 'ALL'
    });
    void this.load();
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
      resourceCounts: Map<string, number>;
    }>();

    for (const item of items) {
      if (!this.isAssignedMovement(item)) {
        continue;
      }

      const technician = this.technicianLabel(item);
      const qty = Math.max(0, Number(item.quantity || 0));
      const resourceLabel = this.resourceLabel(item, materialById, consumableById);

      const current = byTechnician.get(technician) || {
        totalQty: 0,
        movementCount: 0,
        resourceCounts: new Map<string, number>()
      };

      current.totalQty += qty;
      current.movementCount += 1;
      current.resourceCounts.set(resourceLabel, (current.resourceCounts.get(resourceLabel) || 0) + qty);

      byTechnician.set(technician, current);
    }

    return [...byTechnician.entries()]
      .map(([technician, value]) => ({
        technician,
        totalQty: value.totalQty,
        movementCount: value.movementCount,
        topResources: [...value.resourceCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label, quantity]) => ({ label, quantity }))
      }))
      .sort((a, b) => {
        const qtyDiff = b.totalQty - a.totalQty;
        if (qtyDiff !== 0) return qtyDiff;
        return b.movementCount - a.movementCount;
      });
  }

  private buildResourceInsights(items: Movement[], materials: Material[], consumables: Consumable[]): ResourceSummary[] {
    const materialById = new Map(materials.map((item) => [item._id, item]));
    const consumableById = new Map(consumables.map((item) => [item._id, item]));

    const byResource = new Map<string, {
      quantity: number;
      movementCount: number;
      technicians: Set<string>;
    }>();

    for (const item of items) {
      if (!this.isAssignedMovement(item)) {
        continue;
      }

      const resourceLabel = this.resourceLabel(item, materialById, consumableById);
      const technician = this.technicianLabel(item);
      const qty = Math.max(0, Number(item.quantity || 0));

      const current = byResource.get(resourceLabel) || {
        quantity: 0,
        movementCount: 0,
        technicians: new Set<string>()
      };

      current.quantity += qty;
      current.movementCount += 1;
      current.technicians.add(technician);
      byResource.set(resourceLabel, current);
    }

    return [...byResource.entries()]
      .map(([label, value]) => ({
        label,
        quantity: value.quantity,
        movementCount: value.movementCount,
        technicianCount: value.technicians.size
      }))
      .sort((a, b) => {
        const qtyDiff = b.quantity - a.quantity;
        if (qtyDiff !== 0) return qtyDiff;
        const moveDiff = b.movementCount - a.movementCount;
        if (moveDiff !== 0) return moveDiff;
        return b.technicianCount - a.technicianCount;
      });
  }

  private resourceLabel(
    item: Movement,
    materialById: Map<string, Material>,
    consumableById: Map<string, Consumable>
  ): string {
    const linkedMaterial = item.resourceType === 'MATERIAL' ? materialById.get(item.resourceId) : null;
    const linkedConsumable = item.resourceType === 'CONSUMABLE' ? consumableById.get(item.resourceId) : null;
    return String(
      linkedMaterial?.name
        || linkedConsumable?.name
        || item.resourceLabel
        || item.resourceId
        || 'RESSOURCE'
    ).trim() || 'RESSOURCE';
  }

  private technicianLabel(item: Movement): string {
    return String(item.toLabel || item.authorName || item.to?.id || '').trim() || 'TECHNICIEN NON RENSEIGNE';
  }

  private isAssignedMovement(item: Movement): boolean {
    return item.action === 'ASSIGN' && item.status !== 'CANCELED';
  }

  private async loadMonthlyMovements(
    fromDate?: string,
    toDate?: string,
    resourceType: 'ALL' | 'MATERIAL' | 'CONSUMABLE' = 'ALL'
  ): Promise<Movement[][]> {
    const requests: Promise<Movement[]>[] = [];

    if (resourceType === 'ALL' || resourceType === 'CONSUMABLE') {
      requests.push(this.loadPagedMovements('CONSUMABLE', fromDate, toDate));
    }

    if (resourceType === 'ALL' || resourceType === 'MATERIAL') {
      requests.push(this.loadPagedMovements('MATERIAL', fromDate, toDate));
    }

    return Promise.all(requests);
  }

  private async loadPagedMovements(
    resourceType: 'CONSUMABLE' | 'MATERIAL',
    fromDate?: string,
    toDate?: string
  ): Promise<Movement[]> {
    const limit = 1000;
    let page = 1;
    let total = 0;
    const items: Movement[] = [];

    do {
      const res = await firstValueFrom(this.movementService.listRaw({
        resourceType,
        action: 'ASSIGN',
        status: 'COMMITTED',
        toType: 'USER',
        fromDate,
        toDate,
        page,
        limit
      }));

      const pageItems = res.items ?? [];
      items.push(...pageItems);
      total = Number(res.total ?? items.length);
      page += 1;
    } while ((page - 1) * limit < total);

    return items;
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
