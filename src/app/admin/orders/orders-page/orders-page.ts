import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { Order, OrderService } from '../../../core/services/order.service';
import { DepotService } from '../../../core/services/depot.service';
import { ResourceListItem, ResourceListService } from '../../../core/services/resource-list.service';
import { AuthService } from '../../../core/services/auth.service';
import { Depot } from '../../../core/models';
import { Role } from '../../../core/models/roles.model';
import { environment } from '../../../environments/environment';
import { formatPageRange } from '../../../core/utils/pagination';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { preferredPageSize } from '../../../core/utils/page-size';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-orders-page',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './orders-page.html',
  styleUrls: ['./orders-page.scss']
})
export class OrdersPage {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private orders = inject(OrderService);
  private depotService = inject(DepotService);
  private resourceListService = inject(ResourceListService);
  private auth = inject(AuthService);
  private readonly tvaRate = 0.2;
  private readonly apiRoot = (environment.apiBaseUrl || '').replace(/\/api\/?$/, '');

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<Order[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly deleteModalOpen = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');
  readonly importLoading = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importResult = signal<string | null>(null);
  readonly importClient = signal('');
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);
  readonly resources = signal<ResourceListItem[]>([]);
  readonly resourcesLoading = signal(false);
  readonly selectedDepotId = signal('');
  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly managerDepotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) return String((raw as { _id: string })._id);
    return null;
  });
  readonly importPreview = signal<{
    reference: string;
    client: string;
    supplier?: string;
    supplierExists?: boolean;
    date: string;
    status: string;
    amount: number;
    deliveryFee?: number;
    invoicePdfUrl?: string;
    notes: string;
    lines: Array<{
      resourceId: string | null;
      resourceType: 'MATERIAL' | 'CONSUMABLE' | null;
      name: string;
      designation?: string;
      description?: string;
      quantity: number;
      unitPrice: number;
      total: number;
      totalHt?: number;
      totalTva?: number;
      totalTtc?: number;
    }>;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  readonly importModalOpen = signal(false);
  readonly pageRange = formatPageRange;
  readonly sortField = signal<'reference' | 'client' | 'date' | 'status' | 'ttc' | 'tva' | 'delivery'>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly importTotalTva = computed(() => {
    const preview = this.importPreview();
    if (!preview) return 0;
    return preview.lines.reduce((sum, line) => sum + Number(line.totalTva ?? 0), 0);
  });
  readonly totalTva = computed(() =>
    this.items().reduce((sum, order) => sum + this.tvaAmount(order), 0)
  );
  readonly totalTtc = computed(() =>
    this.items().reduce((sum, order) => sum + this.displayAmount(order), 0)
  );

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly sortedItems = computed(() => {
    const items = [...this.items()];
    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    const compareText = (a?: string | null, b?: string | null) =>
      (a ?? '').localeCompare(b ?? '', 'fr', { sensitivity: 'base' });
    const compareNumber = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);
    const compareDate = (value?: string | null) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? time : 0;
    };
    return items.sort((a, b) => {
      switch (field) {
        case 'reference':
          return direction * compareText(a.reference, b.reference);
        case 'client':
          return direction * compareText(a.client, b.client);
        case 'status':
          return direction * compareText(a.status, b.status);
        case 'date':
          return direction * (compareDate(a.date) - compareDate(b.date));
        case 'ttc':
          return direction * compareNumber(this.displayAmount(a), this.displayAmount(b));
        case 'tva':
          return direction * compareNumber(this.tvaAmount(a), this.tvaAmount(b));
        case 'delivery':
          return direction * compareNumber(Number(a.deliveryFee ?? 0), Number(b.deliveryFee ?? 0));
        default:
          return 0;
      }
    });
  });

  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control('')
  });

  constructor() {
    if (this.isDepotManager()) {
      const depotId = this.managerDepotId();
      if (depotId) this.selectedDepotId.set(depotId);
    }
    this.loadDepots();
    this.loadResources();
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

  importPdf(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    this.importLoading.set(true);
    this.importError.set(null);
    this.importPreview.set(null);
    this.orders.importPdfPreview(file, this.importClient()).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        const preview = res.data || null;
        if (preview) {
          const deliveryFee = Number(preview.deliveryFee ?? 0);
          preview.deliveryFee = Number.isFinite(deliveryFee) ? deliveryFee : 0;
        }
        this.importPreview.set(preview);
        this.importModalOpen.set(true);
        this.importClient.set('');
        if (input) input.value = '';
      },
      error: (err: HttpErrorResponse) => {
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.importLoading.set(false);
        this.importError.set(apiMsg || err.message || 'Erreur import fichier');
        if (input) input.value = '';
      }
    });
  }

  closeImportModal(): void {
    this.importModalOpen.set(false);
  }

  confirmImport(): void {
    const preview = this.importPreview();
    if (!preview) return;
    const depotId = this.selectedDepotId();
    if (!depotId) {
      this.importError.set('Sélectionner un dépôt pour l’import.');
      return;
    }
    const validLines = preview.lines
      .filter((line) => line.resourceId && line.resourceType)
      .map((line) => ({
        resourceId: line.resourceId as string,
        resourceType: line.resourceType as 'MATERIAL' | 'CONSUMABLE',
        name: line.name,
        description: line.description || '',
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        total: Number(line.total || 0)
      }))
      .filter((line) => line.quantity > 0);

    this.importLoading.set(true);
    this.importError.set(null);
    this.orders.confirmImportPdf({
      reference: preview.reference,
      client: preview.client,
      supplier: preview.supplier,
      date: preview.date,
      notes: preview.notes,
      amount: preview.amount,
      deliveryFee: Number(preview.deliveryFee ?? 0),
      depotId,
      invoicePdfUrl: preview.invoicePdfUrl,
      lines: validLines
    }).subscribe({
      next: () => {
        this.importLoading.set(false);
        this.importModalOpen.set(false);
        this.importPreview.set(null);
        this.refresh();
      },
      error: (err: HttpErrorResponse) => {
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.importLoading.set(false);
        this.importError.set(apiMsg || err.message || 'Erreur import fichier');
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
    this.setLimitValue(v);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh();
  }

  setSort(field: 'reference' | 'client' | 'date' | 'status' | 'ttc' | 'tva' | 'delivery'): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortField.set(field);
    this.sortDirection.set(field === 'date' ? 'desc' : 'asc');
  }

  sortArrow(field: 'reference' | 'client' | 'date' | 'status' | 'ttc' | 'tva' | 'delivery'): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  tvaAmount(order: Order): number {
    if (Number.isFinite(order.tvaAmount)) {
      return Number(order.tvaAmount);
    }
    if (order.lines?.length) {
      return order.lines.reduce((sum, line) => {
        if (!line.applyTva) return sum;
        const qty = Number(line.quantity ?? 0);
        const unit = Number(line.unitPrice ?? 0);
        if (!Number.isFinite(qty) || !Number.isFinite(unit)) return sum;
        return sum + qty * unit * this.tvaRate;
      }, 0);
    }
    return Number(order.amount ?? 0) * this.tvaRate;
  }

  private isTvaActive(order: Order): boolean {
    if (Number.isFinite(order.tvaAmount)) {
      return Number(order.tvaAmount) > 0;
    }
    return (order.lines || []).some((line) => Boolean(line.applyTva));
  }

  displayAmount(order: Order): number {
    const baseAmount = Number(order.amount ?? 0);
    if (!this.isTvaActive(order)) return baseAmount;
    return baseAmount + this.tvaAmount(order);
  }

  formatAmount(value?: number | string | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0.00';
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
    const prefix = raw.startsWith('/') ? '' : '/';
    return `${this.apiRoot}${prefix}${raw}`;
  }

  previewPdfUrl(): string | null {
    const preview = this.importPreview();
    if (!preview?.invoicePdfUrl) return null;
    if (preview.invoicePdfUrl.startsWith('http://') || preview.invoicePdfUrl.startsWith('https://')) {
      return preview.invoicePdfUrl;
    }
    const prefix = preview.invoicePdfUrl.startsWith('/') ? '' : '/';
    return `${this.apiRoot}${prefix}${preview.invoicePdfUrl}`;
  }

  resourceLabel(item: ResourceListItem): string {
    const type = item.type === 'MATERIAL' ? 'Matériel' : 'Consommable';
    return `${item.name} · ${type}`;
  }

  onDepotSelect(event: Event): void {
    const el = event.target as HTMLSelectElement | null;
    if (!el) return;
    this.selectedDepotId.set(el.value || '');
    this.loadResources();
  }

  updatePreviewField(field: 'reference' | 'client' | 'date' | 'notes' | 'deliveryFee', value: string): void {
    const preview = this.importPreview();
    if (!preview) return;
    const next = { ...preview } as typeof preview;
    if (field === 'deliveryFee') {
      const fee = Number(value || 0);
      next.deliveryFee = Number.isFinite(fee) ? fee : 0;
    } else {
      switch (field) {
        case 'reference':
          next.reference = value;
          break;
        case 'client':
          next.client = value;
          break;
        case 'date':
          next.date = value;
          break;
        case 'notes':
          next.notes = value;
          break;
      }
    }
    this.importPreview.set(next);
  }

  updatePreviewLine(index: number, patch: Partial<{
    designation: string;
    description: string;
    quantity: number | string;
    unitPrice: number | string;
  }>): void {
    const preview = this.importPreview();
    if (!preview) return;
    const lines = preview.lines.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, ...patch };
      const qty = Number(next.quantity ?? 0);
      const unit = Number(next.unitPrice ?? 0);
      const totalHt = this.round2(qty * unit);
      const totalTva = this.round2(totalHt * this.tvaRate);
      const totalTtc = this.round2(totalHt + totalTva);
      return {
        ...next,
        quantity: Number.isFinite(qty) ? qty : 0,
        unitPrice: Number.isFinite(unit) ? unit : 0,
        total: totalHt,
        totalHt,
        totalTva,
        totalTtc
      };
    });
    const amount = this.round2(lines.reduce((sum, line) => sum + Number(line.totalHt ?? line.total ?? 0), 0));
    this.importPreview.set({ ...preview, lines, amount });
  }

  removePreviewLine(index: number): void {
    const preview = this.importPreview();
    if (!preview) return;
    const lines = preview.lines.filter((_, i) => i !== index);
    const amount = this.round2(lines.reduce((sum, line) => sum + Number(line.totalHt ?? line.total ?? 0), 0));
    this.importPreview.set({ ...preview, lines, amount });
  }

  onPreviewResourceChange(index: number, event: Event): void {
    const el = event.target as HTMLSelectElement | null;
    if (!el) return;
    const resourceId = String(el.value || '');
    const resource = this.resources().find((item) => item._id === resourceId);
    if (!resource) {
      this.updatePreviewLine(index, {});
      const preview = this.importPreview();
      if (!preview) return;
      const lines = preview.lines.map((line, i) =>
        i === index ? { ...line, resourceId: null, resourceType: null } : line
      );
      this.importPreview.set({ ...preview, lines });
      return;
    }
    const preview = this.importPreview();
    if (!preview) return;
    const lines = preview.lines.map((line, i) =>
      i === index
        ? {
            ...line,
            resourceId: resource._id,
            resourceType: resource.type,
            name: resource.name
          }
        : line
    );
    this.importPreview.set({ ...preview, lines });
  }

  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotService.refreshDepots(true).subscribe({
      next: (res) => {
        this.depots.set(res.items || []);
        this.depotsLoading.set(false);
      },
      error: () => {
        this.depots.set([]);
        this.depotsLoading.set(false);
      }
    });
  }

  private loadResources(): void {
    this.resourcesLoading.set(true);
    const depotId = this.selectedDepotId();
    this.resourceListService.refresh(depotId || undefined).subscribe({
      next: (res) => {
        this.resources.set(res.data || []);
        this.resourcesLoading.set(false);
      },
      error: () => {
        this.resources.set([]);
        this.resourcesLoading.set(false);
      }
    });
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
