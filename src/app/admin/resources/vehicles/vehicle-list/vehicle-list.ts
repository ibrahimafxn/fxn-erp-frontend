// admin/resources/vehicles/vehicle-list/vehicle-list.ts
import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { DepotService } from '../../../../core/services/depot.service';
import { VehicleService } from '../../../../core/services/vehicle.service';
import { Depot, Vehicle, VehicleListResult } from '../../../../core/models';
import {ConfirmDeleteModal} from '../../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import {DetailBack} from '../../../../core/utils/detail-back';
import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/roles.model';
import { formatDepotName, formatPersonName } from '../../../../core/utils/text-format';


@Component({
  standalone: true,
  selector: 'app-vehicle-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './vehicle-list.html',
  styleUrls: ['./vehicle-list.scss'],
})
export class VehicleList extends DetailBack {
  private svc = inject(VehicleService);
  private depotSvc = inject(DepotService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  // service signals
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly result: Signal<VehicleListResult | null> = this.svc.result;

  // UI state
  readonly deletingId = signal<string | null>(null);

  // Modal state
  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');
  readonly pendingDeleteLabel = signal<string>('véhicule');

  // Pagination
  readonly page = signal(1);
  readonly limit = signal(25);

  // Depots (select)
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  // Filters
  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
  });

  // Derived
  readonly items = computed(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);

  // ✅ confirming = on supprime exactement l’item en attente
  readonly confirmingDelete = computed(() => {
    const pid = this.pendingDeleteId();
    return !!pid && this.deletingId() === pid;
  });

  constructor() {
    super();
    if (!this.isDepotManager()) {
      this.loadDepots();
    }
    this.refresh(true);
  }

  refresh(force = false): void {
    const { q, depot } = this.filterForm.getRawValue();

    this.svc
      .refresh(force, {
        q: q.trim() || undefined,
        depot: depot || undefined,
        page: this.page(),
        limit: this.limit(),
      })
      .subscribe({ error: () => {} });
  }

  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({ q: '', depot: '' });
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

  createNew(): void {
    if (this.isDepotManager()) return;
    this.router.navigate(['/admin/resources/vehicles/new']).then();
  }

  openDetail(v: Vehicle): void {
    const base = this.isDepotManager() ? '/depot/resources/vehicles' : '/admin/resources/vehicles';
    this.router.navigate([base, v._id, 'detail']).then();
  }

  edit(v: Vehicle): void {
    if (this.isDepotManager()) return;
    this.router.navigate(['/admin/resources/vehicles', v._id, 'edit']).then();
  }

  // -----------------------------
  // Confirm Delete Modal (fix)
  // -----------------------------
  openDeleteModal(v: Vehicle): void {
    if (this.isDepotManager()) return;
    this.pendingDeleteId.set(v._id);
    this.pendingDeleteLabel.set('véhicule');
    this.pendingDeleteName.set(this.title(v));
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    // empêche fermeture si en cours de suppression de cet item
    if (this.confirmingDelete()) return;

    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
    this.pendingDeleteLabel.set('véhicule');
  }

  confirmDelete(): void {
    if (this.isDepotManager()) return;
    const id = this.pendingDeleteId();
    if (!id) return;

    this.deletingId.set(id);

    this.svc.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.deleteModalOpen.set(false);
        this.pendingDeleteId.set(null);
        this.pendingDeleteName.set('');
        this.refresh(true);
      },
      error: () => {
        this.deletingId.set(null);
        // on laisse le modal ouvert pour permettre ré-essai / voir l'erreur globale
      },
    });
  }

  // Helpers affichage
  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  title(v: Vehicle): string {
    const parts: string[] = [];
    if (v.brand) parts.push(v.brand);
    if (v.model) parts.push(v.model);
    const label = parts.join(' ').trim();
    return label || (v.plateNumber ?? 'Véhicule');
  }

  assignedLabel(v: Vehicle): string {
    const a = v.assignedTo;
    if (!a) return 'Libre';
    if (typeof a === 'string') return a;
    const name = formatPersonName(a.firstName ?? '', a.lastName ?? '');
    return name || a.email || a._id;
  }

  plate(v: Vehicle): string {
    return v.plateNumber ?? '—';
  }

  createdAtValue(v: Vehicle): string | Date | null {
    return v.createdAt ?? null;
  }

  private loadDepots(): void {
    if (this.isDepotManager()) return;
    this.depotsLoading.set(true);
    this.depotSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  trackById = (_: number, v: Vehicle) => v._id;

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }
}
