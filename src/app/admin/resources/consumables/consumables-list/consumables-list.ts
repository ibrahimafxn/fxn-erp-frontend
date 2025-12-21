// admin/resources/consumables/consumables-list

import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ConsumableService } from '../../../../core/services/consumable.service';
import { DepotService } from '../../../../core/services/depot.service';
import {Consumable, Material} from '../../../../core/models';
import { Depot } from '../../../../core/models';
import { ConsumableListResult } from '../../../../core/models/consumable-list-result.model';
import {ConfirmDeleteModal} from '../../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  selector: 'app-consumables-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, DatePipe, ConfirmDeleteModal],
  templateUrl: './consumables-list.html',
  styleUrls: ['./consumables-list.scss'],
})
export class ConsumablesList {
  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');
  readonly pendingDeleteLabel = signal<string>('élément');

  private consumableService = inject(ConsumableService);
  private depotService = inject(DepotService);
  private router = inject(Router);
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
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  constructor() {
    this.loadDepots();
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

  openDetail(c: Consumable): void {
    // route détail (à ajouter dans admin.routes.ts si pas encore)
    this.router.navigate(['/admin/resources/materials', c._id, 'detail']);
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

  createNew(): void {
    this.router.navigate(['/admin/resources/consumables/new']);
  }

  edit(c: Consumable): void {
    this.router.navigate(['/admin/resources/consumables', c._id, 'edit']);
  }

  openDeleteModal(c: Consumable): void {
    this.pendingDeleteLabel.set(c._id);
    this.pendingDeleteName.set(c.name ?? '');
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
  }

  confirmDelete(): void {
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
  // message d’erreur propre (0 any)
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

  /** Label dépôt (si idDepot est peuplé côté backend -> objet) */
  depotLabel(c: Consumable): string {
    const d = c.idDepot;
    if (!d) return '—';

    if (typeof d === 'object' && '_id' in d) {
      const obj: { _id: string; name?: string } = d;
      return obj.name ?? '—';
    }

    return '—';
  }

  private loadDepots(): void {
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
  protected readonly open = open;
}
