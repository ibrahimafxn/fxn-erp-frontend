import { CommonModule } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { SupplierService, Supplier } from '../../../core/services/supplier.service';
import { Order } from '../../../core/services/order.service';
import { PaginationState } from '../../../core/utils/pagination-state';
import { apiError } from '../../../core/utils/http-error';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-supplier-detail',
  imports: [CommonModule],
  templateUrl: './supplier-detail.html',
  styleUrls: ['./supplier-detail.scss']
})
export class SupplierDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private suppliers = inject(SupplierService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly supplier = signal<Supplier | null>(null);

  readonly orders = signal<Order[]>([]);
  readonly ordersLoading = signal(false);
  readonly ordersError = signal<string | null>(null);

  private readonly pag = new PaginationState();
  readonly page = this.pag.page;
  readonly limit = this.pag.limit;
  readonly pageRange = this.pag.pageRange;
  readonly pageCount = this.pag.pageCount;
  /** Alias transparent : le template utilise ordersTotal(), pag.total est la source de vérité. */
  readonly ordersTotal = this.pag.total;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    if (!id) {
      this.loading.set(false);
      this.error.set('Fournisseur introuvable.');
      return;
    }
    this.loadSupplier(id);
    this.loadOrders(id);
  }

  backToList(): void {
    this.router.navigate(['/admin/suppliers']).then();
  }

  openOrder(order: Order): void {
    if (!order?._id) return;
    this.router.navigate(['/admin/orders', order._id, 'detail']).then();
  }

  prevPage(): void { this.pag.prevPage(() => this.loadOrders(this.supplier()?._id || '')); }
  nextPage(): void { this.pag.nextPage(() => this.loadOrders(this.supplier()?._id || '')); }
  setLimit(value: number): void { this.pag.setLimitValue(value, () => this.loadOrders(this.supplier()?._id || '')); }

  formatCurrency(value?: number | string | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  private loadSupplier(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.suppliers.getById(id).subscribe({
      next: (res) => {
        this.supplier.set(res.data || null);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Erreur chargement fournisseur'));
      }
    });
  }

  private loadOrders(id: string): void {
    if (!id) return;
    this.ordersLoading.set(true);
    this.ordersError.set(null);

    this.suppliers.listOrders(id, { page: this.page(), limit: this.limit() }).subscribe({
      next: (res) => {
        this.orders.set(res.data.items || []);
        this.ordersTotal.set(res.data.total ?? 0);
        if (res.data.page) this.page.set(res.data.page);
        if (res.data.limit) this.limit.set(res.data.limit);
        this.ordersLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.ordersLoading.set(false);
        this.ordersError.set(apiError(err, 'Erreur chargement commandes'));
      }
    });
  }

}
