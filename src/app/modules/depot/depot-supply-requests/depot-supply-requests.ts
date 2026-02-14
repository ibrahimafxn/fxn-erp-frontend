import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SupplyRequest, SupplyRequestStatus, SupplyRequestType } from '../../../core/models';
import { SupplyRequestService } from '../../../core/services/supply-request.service';
import { formatPageRange } from '../../../core/utils/pagination';

@Component({
  selector: 'app-depot-supply-requests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  providers: [DatePipe],
  templateUrl: './depot-supply-requests.html',
  styleUrl: './depot-supply-requests.scss'
})
export class DepotSupplyRequests {
  private supplyService = inject(SupplyRequestService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly items = signal<SupplyRequest[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly limitOptions = [10, 20, 50, 100];
  readonly pageRange = formatPageRange;

  readonly statusFilter = signal<SupplyRequestStatus | ''>('PENDING');
  readonly typeFilter = signal<SupplyRequestType | ''>('');

  readonly decisionOpenId = signal<string | null>(null);
  readonly decisionStatus = signal<'APPROVED' | 'CANCELED'>('APPROVED');
  readonly decisionComment = signal('');
  readonly decidingId = signal<string | null>(null);

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  constructor() {
    this.loadRequests();
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

  setLimit(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.loadRequests(true);
  }

  loadRequests(force = false): void {
    this.loading.set(true);
    this.error.set(null);
    this.supplyService.list({
      page: this.page(),
      limit: this.limit(),
      status: this.statusFilter() || undefined,
      resourceType: this.typeFilter() || undefined
    }).subscribe({
      next: (res) => {
        const data = res?.data;
        this.items.set(data?.items || []);
        this.total.set(data?.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement demandes'));
      }
    });
  }

  startDecision(item: SupplyRequest, status: 'APPROVED' | 'CANCELED'): void {
    this.decisionOpenId.set(item._id);
    this.decisionStatus.set(status);
    this.decisionComment.set('');
  }

  cancelDecision(): void {
    this.decisionOpenId.set(null);
    this.decisionComment.set('');
  }

  updateDecisionComment(value: string): void {
    this.decisionComment.set(value);
  }

  confirmDecision(): void {
    const id = this.decisionOpenId();
    if (!id) return;
    const comment = this.decisionComment().trim();
    if (!comment) {
      this.error.set('Le commentaire est requis pour valider ou annuler.');
      return;
    }
    this.decidingId.set(id);
    this.supplyService.decide(id, { status: this.decisionStatus(), comment }).subscribe({
      next: () => {
        this.decidingId.set(null);
        this.cancelDecision();
        this.loadRequests(true);
      },
      error: (err) => {
        this.decidingId.set(null);
        this.error.set(this.apiError(err, 'Erreur décision'));
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

  userLabel(item: SupplyRequest): string {
    const user = item.user;
    if (!user) return '—';
    const first = user.firstName || '';
    const last = user.lastName || '';
    return `${first} ${last}`.trim() || user.email || '—';
  }

  formattedDate(value?: string | null): string {
    if (!value) return '—';
    return this.datePipe.transform(value, 'short') || '—';
  }

  private apiError(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
  }
}
