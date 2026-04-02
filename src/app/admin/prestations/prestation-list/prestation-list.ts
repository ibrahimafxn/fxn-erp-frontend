import { Component, Signal, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { PrestationService } from '../../../core/services/prestation.service';
import { Prestation, PrestationListResult } from '../../../core/models';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { DetailBack } from '../../../core/utils/detail-back';
import { formatPageRange } from '../../../core/utils/pagination';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-prestation-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './prestation-list.html',
  styleUrls: ['./prestation-list.scss']
})
export class PrestationList extends DetailBack {
  private svc = inject(PrestationService);
  private fb = inject(FormBuilder);

  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly result: Signal<PrestationListResult | null> = this.svc.result;

  readonly deletingId = signal<string | null>(null);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly pageRange = formatPageRange;

  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control('')
  });

  readonly items = computed(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');

  constructor() {
    super();
    this.refresh(true);
  }

  refresh(force = false): void {
    const { q } = this.filterForm.getRawValue();
    this.svc.refreshPrestations(force, {
      q: q.trim() || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({ error: () => {} });
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

  setLimit(v: number): void {
    this.limit.set(v);
    this.page.set(1);
    this.refresh(true);
  }

  createNew(): void {
    this.router.navigate(['/admin/prestations/new']);
  }

  edit(p: Prestation): void {
    this.router.navigate(['/admin/prestations', p._id, 'edit']);
  }

  openDeleteModal(p: Prestation): void {
    this.pendingDeleteId.set(p._id);
    this.pendingDeleteName.set(p.designation || p.code || '');
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

    this.svc.deletePrestation(id).subscribe({
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

  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  formatPrix(p: Prestation): string {
    if (p.prix === null || p.prix === undefined) return '—';
    return `${p.prix.toFixed(2)} €`;
  }

  trackById = (_: number, p: Prestation) => p._id;
}
