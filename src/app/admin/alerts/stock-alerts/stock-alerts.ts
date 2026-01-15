import { CommonModule } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ConsumableService } from '../../../core/services/consumable.service';
import { MaterialService } from '../../../core/services/material.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { DepotService } from '../../../core/services/depot.service';
import { AuthService } from '../../../core/services/auth.service';
import { Consumable, ConsumableListResult, Depot, Material, Vehicle } from '../../../core/models';
import { downloadBlob } from '../../../core/utils/download';
import { Role } from '../../../core/models/roles.model';
import { formatDepotName, formatResourceName } from '../../../core/utils/text-format';

@Component({
  selector: 'app-stock-alerts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stock-alerts.html',
  styleUrl: './stock-alerts.scss',
})
export class StockAlerts {
  private consumableService = inject(ConsumableService);
  private materialService = inject(MaterialService);
  private vehicleService = inject(VehicleService);
  private depotService = inject(DepotService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<ConsumableListResult | null>(null);
  readonly materialResult = signal<{ total: number; page: number; limit: number; items: Material[] } | null>(null);
  readonly vehicleResult = signal<{ total: number; page: number; limit: number; items: Vehicle[] } | null>(null);

  readonly page = signal(1);
  readonly limit = signal(25);

  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    resourceType: this.fb.nonNullable.control<'ALL' | 'CONSUMABLE' | 'MATERIAL' | 'VEHICLE'>('ALL'),
    q: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control('')
  });

  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly managerDepotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) return String((raw as { _id: string })._id);
    return null;
  });

  readonly items = computed<Consumable[]>(() => this.result()?.items ?? []);
  readonly materialItems = computed<Material[]>(() => this.materialResult()?.items ?? []);
  readonly vehicleItems = computed<Vehicle[]>(() => this.vehicleResult()?.items ?? []);
  readonly total = computed(() => {
    const type = this.filterForm.controls.resourceType.value;
    if (type === 'MATERIAL') return this.materialResult()?.total ?? 0;
    if (type === 'VEHICLE') return this.vehicleResult()?.total ?? 0;
    if (type === 'ALL') {
      return (this.result()?.total ?? 0)
        + (this.materialResult()?.total ?? 0)
        + (this.vehicleResult()?.total ?? 0);
    }
    return this.result()?.total ?? 0;
  });
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly currentCount = computed(() => {
    const type = this.filterForm.controls.resourceType.value;
    if (type === 'ALL') {
      return Math.max(this.items().length, this.materialItems().length, this.vehicleItems().length);
    }
    if (type === 'MATERIAL') return this.materialItems().length;
    if (type === 'VEHICLE') return this.vehicleItems().length;
    return this.items().length;
  });
  readonly canNext = computed(() => this.page() < this.pageCount() && this.currentCount() >= this.limit());

  constructor() {
    this.loadDepots();
    this.refresh(true);

    this.filterForm.controls.resourceType.valueChanges.subscribe(() => {
      this.page.set(1);
      this.refresh(true);
    });

    this.filterForm.controls.depot.valueChanges.subscribe(() => {
      this.page.set(1);
      this.refresh(true);
    });
  }

  refresh(force = false): void {
    const f = this.filterForm.getRawValue();
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);

    this.loading.set(true);
    this.error.set(null);

    if (f.resourceType === 'ALL') {
      forkJoin({
        consumables: this.consumableService.alerts({
          q: f.q.trim() || undefined,
          depot: depotId || undefined,
          page: this.page(),
          limit: this.limit()
        }),
        materials: this.materialService.alerts({
          q: f.q.trim() || undefined,
          depot: depotId || undefined,
          page: this.page(),
          limit: this.limit()
        }),
        vehicles: this.vehicleService.alerts({
          q: f.q.trim() || undefined,
          depot: depotId || undefined,
          page: this.page(),
          limit: this.limit()
        })
      }).subscribe({
        next: (res) => {
          this.result.set(res.consumables);
          this.materialResult.set(res.materials);
          this.vehicleResult.set(res.vehicles);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.apiError(err, 'Erreur chargement alertes'));
        }
      });
      return;
    }
    if (f.resourceType === 'MATERIAL') {
      this.materialService.alerts({
        q: f.q.trim() || undefined,
        depot: depotId || undefined,
        page: this.page(),
        limit: this.limit()
      }).subscribe({
        next: (res) => {
          this.materialResult.set(res);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.apiError(err, 'Erreur chargement alertes'));
        }
      });
      return;
    }
    if (f.resourceType === 'VEHICLE') {
      this.vehicleService.alerts({
        q: f.q.trim() || undefined,
        depot: depotId || undefined,
        page: this.page(),
        limit: this.limit()
      }).subscribe({
        next: (res) => {
          this.vehicleResult.set(res);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.apiError(err, 'Erreur chargement alertes'));
        }
      });
      return;
    }

    this.consumableService.alerts({
      q: f.q.trim() || undefined,
      depot: depotId || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement alertes'));
      }
    });
  }

  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({ resourceType: 'ALL', q: '', depot: '' });
    this.page.set(1);
    this.refresh(true);
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh(true);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.refresh(true);
  }

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.limit.set(v);
    this.page.set(1);
    this.refresh(true);
  }

  availableQty(c: Consumable): number {
    const total = c.quantity ?? 0;
    const assigned = c.assignedQuantity ?? 0;
    return Math.max(0, total - assigned);
  }

  availableQtyMaterial(m: Material): number {
    const total = m.quantity ?? 0;
    const assigned = m.assignedQuantity ?? 0;
    return Math.max(0, total - assigned);
  }

  consumableName(c: Consumable): string {
    return formatResourceName(c.name ?? '') || '—';
  }

  materialName(m: Material): string {
    return formatResourceName(m.name ?? '') || '—';
  }

  vehicleLabel(v: Vehicle): string {
    const label = [v.plateNumber, v.brand, v.model].filter(Boolean).join(' ');
    return label || v.plateNumber || '—';
  }

  vehicleProblem(v: Vehicle): string {
    const problem = v.breakdown?.problemType;
    return problem || v.state || '—';
  }

  vehicleTow(v: Vehicle): string {
    if (!v.breakdown) return '—';
    return v.breakdown.needsTow ? 'Oui' : 'Non';
  }

  vehicleRepair(v: Vehicle): string {
    if (!v.breakdown) return '—';
    return v.breakdown.repairMode === 'GARAGE' ? 'Garage' : 'Sur place';
  }

  vehicleGarage(v: Vehicle): string {
    return v.breakdown?.garageName || '—';
  }

  vehicleGarageAddress(v: Vehicle): string {
    return v.breakdown?.garageAddress || '—';
  }

  vehicleBreakdownAddress(v: Vehicle): string {
    return v.breakdown?.address || '—';
  }

  vehicleBreakdownDate(v: Vehicle): string {
    const raw = v.breakdown?.createdAt;
    if (!raw) return '—';
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  }

  depotLabel(c: Consumable): string {
    return this.depotLabelFromRaw(c.idDepot);
  }

  depotLabelMaterial(m: Material): string {
    return this.depotLabelFromRaw(m.idDepot);
  }

  depotLabelVehicle(v: Vehicle): string {
    return this.depotLabelFromRaw(v.idDepot);
  }

  private depotLabelFromRaw(raw: unknown): string {
    if (!raw) return '—';
    if (typeof raw === 'object' && '_id' in raw) {
      const depot = raw as { _id?: string; name?: string; city?: string };
      const name = formatDepotName(depot.name ?? '') || depot._id || '—';
      return name;
    }
    if (typeof raw === 'string') {
      const depot = this.depots().find((d) => d._id === raw);
      if (depot) {
        const name = formatDepotName(depot.name ?? '') || depot._id;
        return name;
      }
    }
    return String(raw);
  }

  goDetail(c: Consumable): void {
    const path = this.isDepotManager()
      ? ['/depot/resources/consumables', c._id, 'detail']
      : ['/admin/resources/consumables', c._id];
    this.router.navigate(path).then();
  }

  goMaterialDetail(m: Material): void {
    const path = this.isDepotManager()
      ? ['/depot/resources/materials', m._id, 'detail']
      : ['/admin/resources/materials', m._id];
    this.router.navigate(path).then();
  }

  goVehicleDetail(v: Vehicle): void {
    const path = this.isDepotManager()
      ? ['/depot/resources/vehicles', v._id, 'detail']
      : ['/admin/resources/vehicles', v._id, 'detail'];
    this.router.navigate(path).then();
  }

  exportCsv(): void {
    const f = this.filterForm.getRawValue();
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);
    const q = f.q.trim() || undefined;

    if (f.resourceType === 'ALL') {
      this.consumableService.alertsExportCsv({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `consumable-alerts-${new Date().toISOString().slice(0, 10)}.csv`),
        error: () => {}
      });
      this.materialService.alertsExportCsv({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `material-alerts-${new Date().toISOString().slice(0, 10)}.csv`),
        error: () => {}
      });
      this.vehicleService.alertsExportCsv({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `vehicle-alerts-${new Date().toISOString().slice(0, 10)}.csv`),
        error: () => {}
      });
      return;
    }
    if (f.resourceType === 'MATERIAL') {
      this.materialService.alertsExportCsv({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `material-alerts-${new Date().toISOString().slice(0, 10)}.csv`),
        error: () => {}
      });
      return;
    }
    if (f.resourceType === 'VEHICLE') {
      this.vehicleService.alertsExportCsv({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `vehicle-alerts-${new Date().toISOString().slice(0, 10)}.csv`),
        error: () => {}
      });
      return;
    }

    this.consumableService.alertsExportCsv({ q, depot: depotId || undefined }).subscribe({
      next: (blob) => downloadBlob(blob, `consumable-alerts-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => {}
    });
  }

  exportPdf(): void {
    const f = this.filterForm.getRawValue();
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);
    const q = f.q.trim() || undefined;

    if (f.resourceType === 'ALL') {
      this.consumableService.alertsExportPdf({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `consumable-alerts-${new Date().toISOString().slice(0, 10)}.pdf`),
        error: () => {}
      });
      this.materialService.alertsExportPdf({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `material-alerts-${new Date().toISOString().slice(0, 10)}.pdf`),
        error: () => {}
      });
      this.vehicleService.alertsExportPdf({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `vehicle-alerts-${new Date().toISOString().slice(0, 10)}.pdf`),
        error: () => {}
      });
      return;
    }
    if (f.resourceType === 'MATERIAL') {
      this.materialService.alertsExportPdf({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `material-alerts-${new Date().toISOString().slice(0, 10)}.pdf`),
        error: () => {}
      });
      return;
    }
    if (f.resourceType === 'VEHICLE') {
      this.vehicleService.alertsExportPdf({ q, depot: depotId || undefined }).subscribe({
        next: (blob) => downloadBlob(blob, `vehicle-alerts-${new Date().toISOString().slice(0, 10)}.pdf`),
        error: () => {}
      });
      return;
    }

    this.consumableService.alertsExportPdf({ q, depot: depotId || undefined }).subscribe({
      next: (blob) => downloadBlob(blob, `consumable-alerts-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => {}
    });
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
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

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }

}
