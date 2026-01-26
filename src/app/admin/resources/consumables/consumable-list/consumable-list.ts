// admin/resources/consumables/consumable-list

import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ConsumableService } from '../../../../core/services/consumable.service';
import { DepotService } from '../../../../core/services/depot.service';
import {Consumable} from '../../../../core/models';
import { Depot } from '../../../../core/models';
import { ConsumableListResult } from '../../../../core/models';
import {ConfirmDeleteModal} from '../../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import {DetailBack} from '../../../../core/utils/detail-back';
import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/roles.model';
import { formatDepotName, formatResourceName } from '../../../../core/utils/text-format';
import { downloadBlob } from '../../../../core/utils/download';

type SortKey = 'name' | 'available' | 'depot' | 'updatedAt' | 'unit';

@Component({
  standalone: true,
  selector: 'app-consumable-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, DatePipe, ConfirmDeleteModal],
  templateUrl: './consumable-list.html',
  styleUrls: ['./consumable-list.scss'],
})
export class ConsumableList extends DetailBack {
  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');
  readonly pendingDeleteLabel = signal<string>('élément');

  private consumableService = inject(ConsumableService);
  private depotService = inject(DepotService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  // Service signals
  readonly loading = this.consumableService.loading;
  readonly error = this.consumableService.error;
  readonly result: Signal<ConsumableListResult | null> = this.consumableService.result;

  // UI state
  readonly deletingId = signal<string | null>(null);

  // Pagination state
  readonly page = signal(1);
  readonly limit = signal(25);

  // Depots (select)
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  // Filtres (q + depot)
  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
  });

  // Derived data
  readonly items = computed(() => this.result()?.items ?? []);
  readonly sortKey = signal<SortKey>('name');
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly sortedItems = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    const items = [...this.items()];
    const factor = dir === 'asc' ? 1 : -1;

    items.sort((a, b) => {
      switch (key) {
        case 'name':
          return factor * this.consumableName(a).localeCompare(this.consumableName(b));
        case 'available':
          return factor * (this.availableQty(a) - this.availableQty(b));
        case 'depot':
          return factor * this.depotLabel(a).localeCompare(this.depotLabel(b));
        case 'unit':
          return factor * String(a.unit || '').localeCompare(String(b.unit || ''));
        case 'updatedAt': {
          const aTime = new Date(this.updatedAtValue(a) || 0).getTime();
          const bTime = new Date(this.updatedAtValue(b) || 0).getTime();
          return factor * (aTime - bTime);
        }
        default:
          return 0;
      }
    });

    return items;
  });
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly isReadOnly = computed(() => this.auth.getUserRole() === Role.TECHNICIEN);

  constructor() {
    super();
    if (!this.isDepotManager()) {
      this.loadDepots();
    }
    this.refresh(true);
  }

  refresh(force = false): void {
    const { q, depot } = this.filterForm.getRawValue();
    this.consumableService.refresh(force, {
      q: q.trim() || undefined,
      depot: depot || undefined,
      page: this.page(),
      limit: this.limit(),
    }).subscribe({ error: () => {} });
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
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.refresh(true);
  }

  nextPage(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.set(this.page() + 1);
    this.refresh(true);
  }

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;

    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;

    this.setLimit(v);
  }

  setLimit(v: number): void {
    this.limit.set(v);
    this.page.set(1);
    this.refresh(true);
  }

  openDetail(c: Consumable): void {
    if (this.isReadOnly()) return;
    const base = this.isDepotManager()
      ? '/depot/resources/consumables'
      : this.isReadOnly()
        ? '/technician/resources/consumables'
        : '/admin/resources/consumables';
    const tail = this.isDepotManager() || this.isReadOnly() ? ['detail'] : [];
    this.router.navigate([base, c._id, ...tail]).then();
  }

  createNew(): void {
    if (this.isDepotManager()) return;
    this.router.navigate(['/admin/resources/consumables/new']).then();
  }

  exportCsv(): void {
    const { q, depot } = this.filterForm.getRawValue();
    this.consumableService.exportCsv({
      q: q.trim() || undefined,
      depot: depot || undefined
    }).subscribe({
      next: (blob) => downloadBlob(blob, `consumables-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => {}
    });
  }

  exportPdf(): void {
    const { q, depot } = this.filterForm.getRawValue();
    this.consumableService.exportPdf({
      q: q.trim() || undefined,
      depot: depot || undefined
    }).subscribe({
      next: (blob) => downloadBlob(blob, `consumables-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => {}
    });
  }

  edit(c: Consumable): void {
    if (this.isDepotManager()) return;
    this.router.navigate(['/admin/resources/consumables', c._id, 'edit']).then();
  }

  openDeleteModal(c: Consumable): void {
    if (this.isDepotManager()) return;
    this.pendingDeleteLabel.set(c._id);
    this.pendingDeleteId.set(c._id);
    this.pendingDeleteName.set(c.name ?? '');
    this.deleteModalOpen.set(true);
  }
  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
  }
  confirmDelete(): void {
    if (this.isDepotManager()) return;
    const id = this.pendingDeleteId();
    if (!id) return;

    this.deleteModalOpen.set(false);
    this.deletingId.set(id);

    // ⚠️ adapte ici selon le service de la page
    this.consumableService.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.refresh(true);
        this.closeDeleteModal();
      },
      error: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
      }
    });
  }

  setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set('asc');
  }

  setUpdatedSort(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const dir = el.value === 'desc' ? 'desc' : 'asc';
    this.sortKey.set('updatedAt');
    this.sortDir.set(dir);
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? '^' : 'v';
  }

  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  createdAtValue(c: Consumable): string | Date | null {
    return c.createdAt ?? null;
  }

  updatedAtValue(c: Consumable): string | Date | null {
    return c.updatedAt ?? null;
  }

  /** Label dépôt (si idDepot est peuplé côté backend -> objet) */
  depotLabel(c: Consumable): string {
    const d = c.idDepot;
    if (!d) return '—';

    if (typeof d === 'object' && '_id' in d) {
      const obj: { _id: string; name?: string } = d;
      return formatDepotName(obj.name) || '—';
    }

    return '—';
  }

  consumableName(c: Consumable): string {
    return formatResourceName(c.name) || '—';
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }

  private loadDepots(): void {
    if (this.isDepotManager() || this.isReadOnly()) return;
    this.depotsLoading.set(true);

    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  trackById = (_: number, c: Consumable) => c._id;

  availableQty(c: Consumable): number {
    const total = Number(c.quantity ?? 0);
    const assigned = Number(c.assignedQuantity ?? 0);
    if (!Number.isFinite(total) || !Number.isFinite(assigned)) return 0;
    return Math.max(0, total - assigned);
  }
}
