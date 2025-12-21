import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { DepotService } from '../../../core/services/depot.service';
import { Depot } from '../../../core/models';
import { DepotListResult } from '../../../core/models/depot-list-result.model';
import {ConfirmDeleteModal} from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  selector: 'app-depot-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './depot-list.html',
  styleUrls: ['./depot-list.scss'],
})
export class DepotList {
  private svc = inject(DepotService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // Service signals
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly result: Signal<DepotListResult | null> = this.svc.result;

  // UI state
  readonly deletingId = signal<string | null>(null);

  // Pagination state
  readonly page = signal(1);
  readonly limit = signal(25);

  // Filters
  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
  });

  // Derived
  readonly items = computed(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  // ─────────────────────────────────────────────
  // ✅ Modal suppression
  // ─────────────────────────────────────────────
  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');

  constructor() {
    this.refresh(true);
  }

  refresh(force = false): void {
    const { q } = this.filterForm.getRawValue();

    this.svc
      .refreshDepots(force, {
        q: q.trim() || undefined,
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
    this.filterForm.setValue({ q: '' });
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

  createNew(): void {
    this.router.navigate(['/admin/depots/new']);
  }

  openDetail(d: Depot): void {
    // ✅ ton pattern: /admin/depots/:id/detail (si c’est ta route)
    this.router.navigate(['/admin/depots', d._id, 'detail']);
  }

  edit(d: Depot): void {
    // ✅ edit: /admin/depots/:id
    this.router.navigate(['/admin/depots', d._id, 'edit']);
  }

  // ─────────────────────────────────────────────
  // ✅ Suppression avec confirmation
  // ─────────────────────────────────────────────
  openDeleteModal(d: Depot): void {
    this.pendingDeleteId.set(d._id);
    this.pendingDeleteName.set(d.name ?? '');
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

    this.svc.deleteDepot(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.refresh(true);
        this.closeDeleteModal();
      },
      error: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
      },
    });
  }

  // Helpers (0 any)
  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';

    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';

    return apiMsg || err.message || 'Erreur inconnue';
  }

  createdAtValue(d: Depot): string | Date | null {
    return d.createdAt ?? null;
  }

  // Manager label : si managerId est peuplé -> objet
  managerLabel(d: Depot): string {
    const m = d.managerId;
    if (!m) return '—';

    if (typeof m === 'object' && '_id' in m) {
      const obj: { _id: string; firstName?: string; lastName?: string; email?: string } = m;
      const name = `${obj.firstName ?? ''} ${obj.lastName ?? ''}`.trim();
      return name || obj.email || '—';
    }

    return '—';
  }

  trackById = (_: number, d: Depot) => d._id;
}
