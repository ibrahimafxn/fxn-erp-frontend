import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { MaterialService } from '../../../core/services/material.service';
import { SupplyRequestService } from '../../../core/services/supply-request.service';
import { AppNotificationService } from '../../../core/services/app-notification.service';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { SupplyRequest, SupplyRequestStatus, SupplyRequestType } from '../../../core/models';
import { formatPageRange } from '../../../core/utils/pagination';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';
import { preferredPageSize } from '../../../core/utils/page-size';

@Component({
  selector: 'app-technician-supply-requests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal, TechnicianMobileNav],
  providers: [DatePipe],
  templateUrl: './technician-supply-requests.html',
  styleUrl: './technician-supply-requests.scss'
})
export class TechnicianSupplyRequests {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private supplyService = inject(SupplyRequestService);
  private notif = inject(AppNotificationService);
  private consumableService = inject(ConsumableService);
  private materialService = inject(MaterialService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(false);
  readonly resourcesLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resourcesError = signal<string | null>(null);

  readonly items = signal<SupplyRequest[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly pageRange = formatPageRange;
  readonly editing = signal<SupplyRequest | null>(null);
  readonly deleteModalOpen = signal(false);
  readonly pendingDelete = signal<SupplyRequest | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly sortKey = signal<'date' | 'resource' | 'type' | 'quantity' | 'status'>('date');
  readonly sortDir = signal<'asc' | 'desc'>('desc');

  readonly statusFilter = signal<SupplyRequestStatus | ''>('');
  readonly typeFilter = signal<SupplyRequestType | ''>('');
  readonly dateFilter = signal('');

  readonly resources = signal<Array<{ _id: string; name?: string; unit?: string }>>([]);
  readonly resourceQuery = signal('');

  readonly form = this.fb.nonNullable.group({
    resourceType: this.fb.nonNullable.control<SupplyRequestType>('CONSUMABLE', [Validators.required]),
    resourceId: this.fb.nonNullable.control('', [Validators.required]),
    quantity: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
    note: this.fb.nonNullable.control('')
  });

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly filteredItems = computed(() => {
    const items = [...this.items()];
    const selected = this.dateFilter();
    if (!selected) return items;
    const start = new Date(selected);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selected);
    end.setHours(23, 59, 59, 999);
    const startTs = start.getTime();
    const endTs = end.getTime();
    return items.filter((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return createdAt >= startTs && createdAt <= endTs;
    });
  });

  readonly sortedItems = computed(() => {
    const items = [...this.filteredItems()];
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (key === 'date') {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (aDate - bDate) * dir;
      }
      if (key === 'resource') {
        const aLabel = this.resourceLabel(a).toLowerCase();
        const bLabel = this.resourceLabel(b).toLowerCase();
        return aLabel.localeCompare(bLabel) * dir;
      }
      if (key === 'quantity') {
        const aQty = Number(a.quantity || 0);
        const bQty = Number(b.quantity || 0);
        return (aQty - bQty) * dir;
      }
      if (key === 'status') {
        const order = ['PENDING', 'APPROVED', 'CANCELED'];
        const aIdx = order.indexOf(a.status || 'PENDING');
        const bIdx = order.indexOf(b.status || 'PENDING');
        return (aIdx - bIdx) * dir;
      }
      const aType = a.resourceType || '';
      const bType = b.resourceType || '';
      return aType.localeCompare(bType) * dir;
    });
  });

  constructor() {
    this.loadRequests();
    this.loadResources(true);
    this.form.controls.resourceType.valueChanges.subscribe((value) => {
      this.form.controls.resourceId.setValue('');
      this.resourceQuery.set('');
      this.loadResources(true, value);
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const payload = this.form.getRawValue();
    const current = this.editing();
    const request$ = current?._id
      ? this.supplyService.update(current._id, {
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        quantity: payload.quantity,
        note: payload.note
      })
      : this.supplyService.create({
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        quantity: payload.quantity,
        note: payload.note
      });
    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.editing.set(null);
        this.notif.notifyAction(
          'Demande envoyée',
          'Votre demande de stock a bien été transmise au dépôt.',
          `supply-req-${Date.now()}`
        );
        this.notif.beep('success');
        this.resetForm();
        this.loadRequests(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur envoi demande'));
      }
    });
  }

  resetForm(): void {
    this.form.reset({ resourceType: 'CONSUMABLE', resourceId: '', quantity: 1, note: '' });
    this.editing.set(null);
    this.resourceQuery.set('');
    this.loadResources(true, 'CONSUMABLE');
  }

  onResourceQuery(value: string): void {
    this.resourceQuery.set(value);
    this.loadResources(true);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as SupplyRequestStatus | '');
    this.page.set(1);
    this.loadRequests(true);
  }

  setTypeFilter(value: string): void {
    this.typeFilter.set(value as SupplyRequestType | '');
    this.page.set(1);
    this.loadRequests(true);
  }

  setDateFilter(value: string): void {
    this.dateFilter.set(value);
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.update((v) => v - 1);
    this.loadRequests(true);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.update((v) => v + 1);
    this.loadRequests(true);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.loadRequests(true);
  }

  loadRequests(force = false): void {
    this.loading.set(true);
    this.error.set(null);
    const previous = this.items();
    this.supplyService.listMine({
      page: this.page(),
      limit: this.limit(),
      status: this.statusFilter() || undefined,
      resourceType: this.typeFilter() || undefined
    }).subscribe({
      next: (res) => {
        const data = res?.data;
        const current = data?.items || [];
        this.notifySupplyStatusChanges(previous, current);
        this.items.set(current);
        this.total.set(data?.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement demandes'));
      }
    });
  }

  private notifySupplyStatusChanges(prev: SupplyRequest[], next: SupplyRequest[]): void {
    if (!prev.length) return;
    const prevMap = new Map(prev.map(r => [r._id, r.status]));
    next.forEach(r => {
      const prevStatus = prevMap.get(r._id);
      if (!prevStatus || prevStatus === r.status || prevStatus !== 'PENDING') return;
      const label = this.resourceLabel(r);
      if (r.status === 'APPROVED') {
        this.notif.notifyAction(
          'Demande approuvée',
          `Votre demande de ${label} a été approuvée par le dépôt.`,
          `supply-approved-${r._id}`
        );
        this.notif.beep('success');
      } else if (r.status === 'CANCELED') {
        this.notif.notifyAction(
          'Demande annulée',
          `Votre demande de ${label} a été annulée par le dépôt.`,
          `supply-canceled-${r._id}`
        );
        this.notif.beep('alert');
      }
    });
  }

  loadResources(force = false, type?: SupplyRequestType): void {
    const resourceType = type || this.form.controls.resourceType.value;
    const depot = this.auth.user$()?.idDepot || undefined;
    const q = this.resourceQuery().trim();
    this.resourcesLoading.set(true);
    this.resourcesError.set(null);

    const onError = (err: unknown) => {
      this.resourcesLoading.set(false);
      this.resourcesError.set(this.apiError(err, 'Erreur chargement ressources'));
    };

    if (resourceType === 'MATERIAL') {
      this.materialService.refresh(force, { q: q || undefined, depot, page: 1, limit: 50 }).subscribe({
        next: (result) => {
          this.resources.set(result?.items || []);
          this.resourcesLoading.set(false);
        },
        error: onError
      });
      return;
    }

    this.consumableService.refresh(force, { q: q || undefined, depot, page: 1, limit: 50 }).subscribe({
      next: (result) => {
        this.resources.set(result?.items || []);
        this.resourcesLoading.set(false);
      },
      error: onError
    });
  }

  toggleSort(key: 'date' | 'resource' | 'type' | 'quantity' | 'status'): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set('asc');
  }

  sortIcon(key: 'date' | 'resource' | 'type' | 'quantity' | 'status'): string {
    if (this.sortKey() !== key) return 'unfold_more';
    return this.sortDir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  editRequest(item: SupplyRequest): void {
    if (item.status !== 'PENDING') return;
    this.editing.set(item);
    this.form.patchValue({
      resourceType: item.resourceType,
      resourceId: item.resource?._id || '',
      quantity: item.quantity,
      note: item.note || ''
    });
    this.resourceQuery.set('');
    this.loadResources(true, item.resourceType);
  }

  openDeleteModal(item: SupplyRequest): void {
    this.pendingDelete.set(item);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item?._id) return;
    this.deletingId.set(item._id);
    this.supplyService.remove(item._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
        this.loadRequests(true);
      },
      error: (err) => {
        this.deletingId.set(null);
        this.error.set(this.apiError(err, 'Erreur suppression'));
      }
    });
  }

  statusLabel(status: SupplyRequestStatus): string {
    if (status === 'APPROVED') return 'Validée';
    if (status === 'CANCELED') return 'Annulée';
    return 'En attente';
  }

  statusClass(status: SupplyRequestStatus): string {
    if (status === 'APPROVED') return 'status-approved';
    if (status === 'CANCELED') return 'status-canceled';
    return 'status-pending';
  }

  resourceLabel(item: SupplyRequest): string {
    return item.resourceName || item.resource?.name || '—';
  }

  formattedDate(value?: string | null): string {
    if (!value) return '—';
    return this.datePipe.transform(value, 'short') || '—';
  }

  private apiError(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
  }
}
