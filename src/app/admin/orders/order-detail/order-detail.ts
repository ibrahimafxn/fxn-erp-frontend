import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { Order, OrderLine, OrderService } from '../../../core/services/order.service';
import { Depot } from '../../../core/models';
import { Movement } from '../../../core/models/movement.model';
import { DepotService } from '../../../core/services/depot.service';
import { MovementService } from '../../../core/services/movement.service';
import { formatDepotName } from '../../../core/utils/text-format';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { environment } from '../../../environments/environment';

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
  private movementsSvc = inject(MovementService);
  private readonly apiRoot = (environment.apiBaseUrl || '').replace(/\/api\/?$/, '');
  private readonly tvaRate = 0.2;

  // ── Core state ──────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly order = signal<Order | null>(null);
  readonly depots = signal<Depot[]>([]);

  // ── Import state ────────────────────────────────────────────────────────────
  readonly selectedDepotId = signal('');
  readonly importLoading = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importResult = signal<string | null>(null);
  readonly importConfirmOpen = signal(false);

  // ── Line delete state ────────────────────────────────────────────────────────
  readonly deleteLineId = signal<string | null>(null);
  readonly deleteLineConfirmOpen = signal(false);
  readonly deletingLine = signal(false);
  readonly deleteLineError = signal<string | null>(null);

  // ── Movements traceability ──────────────────────────────────────────────────
  readonly importMovements = signal<Movement[]>([]);
  readonly movementsLoading = signal(false);
  readonly movementsError = signal<string | null>(null);

  // ── Computed financials ─────────────────────────────────────────────────────
  readonly orderHt = computed(() => {
    const o = this.order();
    if (!o) return 0;
    if (o.lines?.length) {
      return o.lines.reduce((sum, l) => sum + Number(l.total ?? (l.quantity * l.unitPrice)), 0);
    }
    return Number(o.amount ?? 0);
  });

  readonly orderTva = computed(() => {
    const o = this.order();
    if (!o) return 0;
    if (Number.isFinite(o.tvaAmount) && (o.tvaAmount ?? 0) > 0) return Number(o.tvaAmount);
    if (o.lines?.length) {
      return o.lines.reduce((sum, l) => {
        if (!l.applyTva) return sum;
        const total = Number(l.total ?? (l.quantity * l.unitPrice));
        return sum + Math.round(total * this.tvaRate * 100) / 100;
      }, 0);
    }
    return Number(o.amount ?? 0) * this.tvaRate;
  });

  readonly orderTtc = computed(() => this.orderHt() + this.orderTva());
  readonly orderDelivery = computed(() => Number(this.order()?.deliveryFee ?? 0));
  readonly orderTotalDue = computed(() => this.orderTtc() + this.orderDelivery());

  // ── Status flags ────────────────────────────────────────────────────────────
  readonly alreadyImported = computed(() => !!this.order()?.importedToDepotAt);

  readonly isImportable = computed(() => {
    const o = this.order();
    if (!o) return false;
    if (o.statusCode === 'IMPORTABLE') return true;
    if (o.statusCode === 'CANCELED') return false;
    const s = this.normalizeStatus(o.status);
    if (!s) return false;
    if (s.includes('ANNULE') || s.includes('ECHEC') || s.includes('REFUSE')) return false;
    return s.includes('ENCOURS') || s.startsWith('VALID') || s.includes('LIVR');
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

  // ── Navigation ───────────────────────────────────────────────────────────────
  backToList(): void {
    if (window.history.length > 1) { this.location.back(); return; }
    this.router.navigate(['/admin/orders']);
  }

  editOrder(): void {
    const id = this.order()?._id;
    if (id) this.router.navigate(['/admin/orders', id, 'edit']);
  }

  // ── Display helpers ───────────────────────────────────────────────────────────
  lineTva(line: OrderLine): number {
    if (!line.applyTva) return 0;
    const total = Number(line.total ?? (line.quantity * line.unitPrice));
    return Math.round(total * this.tvaRate * 100) / 100;
  }

  formatCurrency(value?: number | string | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  pdfUrl(order: Order | null | undefined): string | null {
    const raw = order?.invoicePdfUrl || '';
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `${this.apiRoot}${raw.startsWith('/') ? '' : '/'}${raw}`;
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || d.name || '—';
  }

  depotNameById(id?: string | null): string {
    if (!id) return '—';
    const depot = this.depots().find((d) => d._id === String(id));
    return depot ? this.depotOptionLabel(depot) : '—';
  }

  importEntityName(): string {
    const ref = this.order()?.reference || '';
    const depotName = this.depotNameById(this.selectedDepotId());
    return ref ? `${ref} → ${depotName}` : depotName;
  }

  statusBadgeClass(status?: string | null): string {
    const s = (status || '').toLowerCase();
    if (s.includes('cours')) return 'badge-pending';
    if (s.includes('valid')) return 'badge-validated';
    if (s.includes('livr')) return 'badge-delivered';
    if (s.includes('annul') || s.includes('cancel')) return 'badge-canceled';
    return 'badge-unknown';
  }

  resourceTypeLabel(type: string): string {
    return type === 'MATERIAL' ? 'Matériel' : 'Consommable';
  }

  movementActionLabel(action: string): string {
    const labels: Record<string, string> = {
      IN: 'Entrée stock',
      OUT: 'Sortie stock',
      ADJUST: 'Ajustement',
      CREATE: 'Création',
      TRANSFER: 'Transfert',
      ASSIGN: 'Attribution',
      RELEASE: 'Restitution'
    };
    return labels[action] || action;
  }

  // ── Depot selection ───────────────────────────────────────────────────────────
  onDepotSelect(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    this.selectedDepotId.set(el.value || '');
    this.importError.set(null);
    this.importResult.set(null);
  }

  // ── Import flow ───────────────────────────────────────────────────────────────
  openImportModal(): void {
    if (!this.order() || !this.selectedDepotId()) return;
    if (this.alreadyImported() || !this.isImportable()) return;
    this.importConfirmOpen.set(true);
  }

  cancelImportModal(): void {
    if (this.importLoading()) return;
    this.importConfirmOpen.set(false);
  }

  confirmImport(): void {
    if (this.importLoading()) return;
    this.importConfirmOpen.set(false);
    this.runImportToDepot();
  }

  private runImportToDepot(): void {
    const depotId = this.selectedDepotId();
    const order = this.order();
    if (!order || !depotId) return;
    if (this.alreadyImported() || !this.isImportable()) return;

    this.importLoading.set(true);
    this.importError.set(null);
    this.importResult.set(null);

    this.orders.importToDepot(order._id, depotId).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        const count = res.data?.count ?? 0;
        this.importResult.set(`${count} article(s) importé(s) avec succès.`);
        this.load(order._id);
      },
      error: (err: HttpErrorResponse) => {
        this.importLoading.set(false);
        this.importError.set(this.apiError(err, 'Erreur import dépôt'));
      }
    });
  }

  // ── Line delete ───────────────────────────────────────────────────────────────
  openDeleteLineModal(lineId: string): void {
    this.deleteLineId.set(lineId);
    this.deleteLineError.set(null);
    this.deleteLineConfirmOpen.set(true);
  }

  cancelDeleteLineModal(): void {
    if (this.deletingLine()) return;
    this.deleteLineConfirmOpen.set(false);
    this.deleteLineId.set(null);
  }

  confirmDeleteLine(): void {
    const orderId = this.order()?._id;
    const lineId = this.deleteLineId();
    if (!orderId || !lineId || this.deletingLine()) return;

    this.deletingLine.set(true);
    this.deleteLineError.set(null);
    this.orders.removeLineFromOrder(orderId, lineId).subscribe({
      next: (res) => {
        this.order.set(res.data || null);
        this.deletingLine.set(false);
        this.deleteLineConfirmOpen.set(false);
        this.deleteLineId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingLine.set(false);
        this.deleteLineError.set(this.apiError(err, 'Erreur suppression ligne'));
      }
    });
  }

  deleteLineEntityName(): string {
    const line = this.order()?.lines?.find(l => l._id === this.deleteLineId());
    return line?.name ?? 'cette ligne';
  }

  // ── Private loaders ───────────────────────────────────────────────────────────
  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.orders.getById(id).subscribe({
      next: (res) => {
        const order = res.data || null;
        this.order.set(order);
        this.loading.set(false);
        if (order?.importedToDepotAt) {
          this.loadImportMovements();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement commande'));
      }
    });
  }

  private loadDepots(): void {
    this.depotsSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => { this.depots.set(res.items || []); },
      error: () => {}
    });
  }

  private loadImportMovements(): void {
    const order = this.order();
    if (!order?.importedToDepotId || !order?.importedToDepotAt) return;

    this.movementsLoading.set(true);
    this.movementsError.set(null);

    const importDate = new Date(order.importedToDepotAt);
    const fromDate = new Date(importDate.getTime() - 5 * 60_000).toISOString();
    const toDate = new Date(importDate.getTime() + 15 * 60_000).toISOString();

    this.movementsSvc.listRaw({
      reason: 'RECEPTION_COMMANDE',
      depotId: String(order.importedToDepotId),
      fromDate,
      toDate,
      limit: 100
    }).subscribe({
      next: (res) => {
        const ref = order.reference || '';
        const filtered = (res.items || []).filter(m =>
          !ref || (m.note || '').includes(ref)
        );
        this.importMovements.set(filtered);
        this.movementsLoading.set(false);
      },
      error: () => {
        this.movementsError.set('Impossible de charger la traçabilité des mouvements.');
        this.movementsLoading.set(false);
      }
    });
  }

  private normalizeStatus(value?: string | null): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const msg = typeof err.error === 'object' && err.error !== null && 'message' in err.error
      ? String((err.error as { message?: unknown }).message ?? '') : '';
    return msg || err.message || fallback;
  }
}
