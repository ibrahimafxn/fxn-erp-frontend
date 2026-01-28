import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { Order, OrderLine, OrderService } from '../../../core/services/order.service';
import { Depot } from '../../../core/models';
import { DepotService } from '../../../core/services/depot.service';
import { formatDepotName } from '../../../core/utils/text-format';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-order-detail',
  imports: [CommonModule, ConfirmDeleteModal],
  templateUrl: './order-detail.html',
  styleUrls: ['./order-detail.scss']
})
export class OrderDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private orders = inject(OrderService);
  private depotsSvc = inject(DepotService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly order = signal<Order | null>(null);
  readonly depots = signal<Depot[]>([]);
  readonly selectedDepotId = signal('');
  readonly importLoading = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importResult = signal<string | null>(null);
  readonly importConfirmOpen = signal(false);
  readonly isImportable = computed(() => {
    const status = this.normalizeStatus(this.order()?.status);
    if (!status) return false;
    if (status.includes('ANNULE') || status.includes('ECHEC') || status.includes('REFUSE')) return false;
    return status.includes('ENCOURS') || status.startsWith('VALID');
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    if (!id) {
      this.loading.set(false);
      this.error.set('Commande introuvable.');
      return;
    }
    this.load(id);
    this.loadDepots();
  }

  backToList(): void {
    this.location.back();
  }

  linesTotal(lines: OrderLine[] = []): number {
    return lines.reduce((sum, line) => sum + (line.total ?? (line.quantity * line.unitPrice)), 0);
  }

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

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || d.name || '—';
  }

  private normalizeStatus(value?: string | null): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  depotNameById(id?: string | null): string {
    if (!id) return '—';
    const depot = this.depots().find((d) => d._id === id);
    return depot ? this.depotOptionLabel(depot) : '—';
  }

  importEntityName(): string {
    const order = this.order();
    const depotName = this.depotNameById(this.selectedDepotId());
    const ref = order?.reference || '';
    return ref ? `${ref} → ${depotName}` : depotName;
  }

  onDepotSelect(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    this.selectedDepotId.set(el.value || '');
    this.importError.set(null);
    this.importResult.set(null);
  }

  openImportModal(): void {
    const depotId = this.selectedDepotId();
    const order = this.order();
    if (!order || !depotId) return;
    if (order.importedToDepotAt || !this.isImportable()) return;
    this.importConfirmOpen.set(true);
  }

  cancelImportModal(): void {
    if (this.importLoading()) return;
    this.importConfirmOpen.set(false);
  }

  confirmImport(): void {
    if (this.importLoading()) return;
    this.importConfirmOpen.set(false);
    this.importToDepot();
  }

  private importToDepot(): void {
    const depotId = this.selectedDepotId();
    const order = this.order();
    if (!order || !depotId) return;
    if (order.importedToDepotAt || !this.isImportable()) return;

    this.importLoading.set(true);
    this.importError.set(null);
    this.importResult.set(null);

    this.orders.importToDepot(order._id, depotId).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        const count = res.data?.count ?? 0;
        this.importResult.set(`Import terminé (${count} article(s)).`);
      },
      error: (err: HttpErrorResponse) => {
        this.importLoading.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.importError.set(apiMsg || err.message || 'Erreur import dépôt');
      }
    });
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

  private loadDepots(): void {
    this.depotsSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items || []);
      },
      error: () => {}
    });
  }
}
