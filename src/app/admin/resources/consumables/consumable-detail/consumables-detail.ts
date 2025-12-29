import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ConsumableService } from '../../../../core/services/consumable.service';
import { AttributionHistoryItem, AttributionHistoryResult, Consumable } from '../../../../core/models';
import { DetailBack } from '../../../../core/utils/detail-back';
import { formatDepotName, formatPersonName, formatResourceName } from '../../../../core/utils/text-format';

@Component({
  selector: 'app-consumable-detail',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './consumables-detail.html',
  styleUrl: './consumables-detail.scss',
})
export class ConsumablesDetail extends DetailBack {
  private svc = inject(ConsumableService);
  private route = inject(ActivatedRoute);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly consumable = signal<Consumable | null>(null);

  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly history = signal<AttributionHistoryResult | null>(null);

  readonly historyPage = signal(1);
  readonly historyLimit = signal(10);
  readonly historyItems = computed<AttributionHistoryItem[]>(() => this.history()?.items ?? []);
  readonly historyTotal = computed(() => this.history()?.total ?? 0);
  readonly historyPageCount = computed(() => {
    const t = this.historyTotal();
    const l = this.historyLimit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrevHistory = computed(() => this.historyPage() > 1);
  readonly canNextHistory = computed(() => this.historyPage() < this.historyPageCount());

  readonly availableQty = computed(() => {
    const c = this.consumable();
    if (!c) return 0;
    const total = c.quantity ?? 0;
    const assigned = c.assignedQuantity ?? 0;
    return Math.max(0, total - assigned);
  });

  constructor() {
    super();
    this.load();
    this.loadHistory(true);
  }

  load(): void {
    if (!this.id) return;
    this.loading.set(true);
    this.error.set(null);
    this.svc.getById(this.id).subscribe({
      next: (c) => {
        this.consumable.set(c);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement consommable'));
      }
    });
  }

  loadHistory(forcePageReset = false): void {
    if (!this.id) return;
    if (forcePageReset) this.historyPage.set(1);
    this.historyLoading.set(true);
    this.historyError.set(null);

    this.svc.history(this.id, this.historyPage(), this.historyLimit()).subscribe({
      next: (res) => {
        this.history.set(res);
        this.historyLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.historyLoading.set(false);
        this.historyError.set(this.apiError(err, 'Erreur chargement historique'));
      }
    });
  }

  refresh(): void {
    this.load();
    this.loadHistory(true);
  }

  prevHistory(): void {
    if (!this.canPrevHistory()) return;
    this.historyPage.set(this.historyPage() - 1);
    this.loadHistory();
  }

  nextHistory(): void {
    if (!this.canNextHistory()) return;
    this.historyPage.set(this.historyPage() + 1);
    this.loadHistory();
  }

  setHistoryLimit(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.historyLimit.set(v);
    this.loadHistory(true);
  }

  actionLabel(action?: string): string {
    switch (action) {
      case 'AJOUT': return 'Ajout';
      case 'SORTIE': return 'Sortie';
      case 'PERTE': return 'Perte';
      case 'ATTRIBUTION': return 'Attribution';
      case 'REPRISE': return 'Reprise';
      default: return action || '—';
    }
  }

  authorLabel(item: AttributionHistoryItem): string {
    const a = item?.attribution?.author;
    if (!a) return '—';
    if (typeof a === 'string') return this.shortId(a);
    const name = formatPersonName(a.firstName ?? '', a.lastName ?? '');
    return name || a.email || this.shortId(a._id);
  }

  toUserLabel(item: AttributionHistoryItem): string {
    const u = item?.attribution?.toUser;
    if (!u) return '—';
    if (typeof u === 'string') return this.shortId(u);
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || this.shortId(u._id);
  }

  depotLabel(item: AttributionHistoryItem): string {
    const d = item?.attribution?.fromDepot;
    if (!d) return '—';
    if (typeof d === 'string') return this.shortId(d);
    const name = formatDepotName(d.name ?? '') || this.shortId(d._id);
    return d.city ? `${name} · ${d.city}` : name;
  }

  noteLabel(item: AttributionHistoryItem): string {
    const note = item?.attribution?.note ?? item?.note;
    return typeof note === 'string' && note.trim() ? note.trim() : '—';
  }

  createdAtValue(item: AttributionHistoryItem): string | Date | null {
    return item?.attribution?.createdAt ?? item?.createdAt ?? null;
  }

  depotName(): string {
    const d = this.consumable()?.idDepot;
    if (!d) return '—';
    if (typeof d === 'object' && '_id' in d) return formatDepotName(d.name) || '—';
    return '—';
  }

  consumableName(): string {
    return formatResourceName(this.consumable()?.name ?? '') || '—';
  }

  unitLabel(): string {
    return this.consumable()?.unit || '—';
  }

  private shortId(id?: string | null): string {
    if (!id) return '—';
    return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
