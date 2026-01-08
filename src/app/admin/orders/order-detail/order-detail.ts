import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { Order, OrderService } from '../../../core/services/order.service';

@Component({
  standalone: true,
  selector: 'app-order-detail',
  imports: [CommonModule],
  templateUrl: './order-detail.html',
  styleUrls: ['./order-detail.scss']
})
export class OrderDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orders = inject(OrderService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly order = signal<Order | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    if (!id) {
      this.loading.set(false);
      this.error.set('Commande introuvable.');
      return;
    }
    this.load(id);
  }

  backToList(): void {
    this.router.navigate(['/admin/orders']).then();
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.orders.getById(id).subscribe({
      next: (res) => {
        this.order.set(res.data || null);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.error.set(apiMsg || err.message || 'Erreur chargement commande');
      }
    });
  }
}
