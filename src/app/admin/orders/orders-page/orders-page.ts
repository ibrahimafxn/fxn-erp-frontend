import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { Order, OrderService } from '../../../core/services/order.service';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  selector: 'app-orders-page',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './orders-page.html',
  styleUrls: ['./orders-page.scss']
})
export class OrdersPage {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private orders = inject(OrderService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<Order[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly deleteModalOpen = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control('')
  });

  constructor() {
    this.refresh();
  }

  createNew(): void {
    this.router.navigate(['/admin/orders/new']).then();
  }

  openDetail(order: Order): void {
    this.router.navigate(['/admin/orders', order._id, 'detail']).then();
  }

  openEdit(order: Order): void {
    this.router.navigate(['/admin/orders', order._id, 'edit']).then();
  }

  openDeleteModal(order: Order): void {
    this.pendingDeleteId.set(order._id);
    this.pendingDeleteName.set(order.reference || order.client || '');
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
    this.deletingId.set(id);
    this.orders.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.error.set(apiMsg || err.message || 'Erreur suppression commande');
        this.deletingId.set(null);
        this.closeDeleteModal();
      }
    });
  }

  refresh(): void {
    const f = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.orders.list({
      q: f.q.trim() || undefined,
      status: f.status.trim() || undefined,
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
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.error.set(apiMsg || err.message || 'Erreur chargement commandes');
        this.loading.set(false);
      }
    });
  }

  search(): void {
    this.page.set(1);
    this.refresh();
  }

  clearFilters(): void {
    this.filterForm.setValue({ q: '', status: '' });
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

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.limit.set(v);
    this.page.set(1);
    this.refresh();
  }
}
