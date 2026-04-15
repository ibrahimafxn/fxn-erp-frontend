import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { Supplier, SupplierService } from '../../../core/services/supplier.service';
import { formatPageRange } from '../../../core/utils/pagination';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { preferredPageSize } from '../../../core/utils/page-size';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-supplier-list',
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './supplier-list.html',
  styleUrls: ['./supplier-list.scss']
})
export class SupplierList {
  private fb = inject(FormBuilder);
  private suppliers = inject(SupplierService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<Supplier[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly pageRange = formatPageRange;

  readonly createName = signal('');
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  readonly deleteModalOpen = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal('');

  readonly editModalOpen = signal(false);
  readonly editingSupplier = signal<Supplier | null>(null);
  readonly editName = signal('');
  readonly editError = signal<string | null>(null);
  readonly updating = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control('')
  });

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  constructor() {
    this.refresh();
  }

  openDetail(item: Supplier): void {
    if (!item?._id) return;
    this.router.navigate(['/admin/suppliers', item._id, 'detail']).then();
  }

  refresh(): void {
    const { q } = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.suppliers.list({
      q: q.trim() || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        this.items.set(res.data.items || []);
        this.total.set(res.data.total ?? 0);
        if (res.data.page) this.page.set(res.data.page);
        if (res.data.limit) this.limit.set(res.data.limit);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.apiError(err, 'Erreur chargement fournisseurs'));
        this.loading.set(false);
      }
    });
  }

  search(): void {
    this.page.set(1);
    this.refresh();
  }

  clearSearch(): void {
    this.filterForm.setValue({ q: '' });
    this.page.set(1);
    this.refresh();
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.refresh();
  }

  nextPage(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.set(this.page() + 1);
    this.refresh();
  }

  setLimit(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh();
  }

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.setLimit(v);
  }

  createSupplier(): void {
    const name = this.createName().trim();
    if (name.length < 2) {
      this.createError.set('Nom requis (min 2 caractères).');
      return;
    }
    this.creating.set(true);
    this.createError.set(null);
    this.suppliers.create({ name }).subscribe({
      next: () => {
        this.creating.set(false);
        this.createName.set('');
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        this.creating.set(false);
        this.createError.set(this.apiError(err, 'Erreur création fournisseur'));
      }
    });
  }

  openEditModal(item: Supplier): void {
    this.editingSupplier.set(item);
    this.editName.set(item.name || '');
    this.editError.set(null);
    this.editModalOpen.set(true);
  }

  closeEditModal(): void {
    if (this.updating()) return;
    this.editModalOpen.set(false);
    this.editingSupplier.set(null);
    this.editName.set('');
    this.editError.set(null);
  }

  updateSupplier(): void {
    const supplier = this.editingSupplier();
    if (!supplier?._id) return;
    const name = this.editName().trim();
    if (name.length < 2) {
      this.editError.set('Nom requis (min 2 caractères).');
      return;
    }
    this.updating.set(true);
    this.editError.set(null);
    this.suppliers.update(supplier._id, { name }).subscribe({
      next: () => {
        this.updating.set(false);
        this.closeEditModal();
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        this.updating.set(false);
        this.editError.set(this.apiError(err, 'Erreur modification fournisseur'));
      }
    });
  }

  openDeleteModal(item: Supplier): void {
    if (!item._id) return;
    this.pendingDeleteId.set(item._id);
    this.pendingDeleteName.set(item.name || '');
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    if (this.deletingId()) return;
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
  }

  confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id) return;
    this.deletingId.set(id);
    this.suppliers.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        this.closeDeleteModal();
        this.error.set(this.apiError(err, 'Erreur suppression fournisseur'));
      }
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
