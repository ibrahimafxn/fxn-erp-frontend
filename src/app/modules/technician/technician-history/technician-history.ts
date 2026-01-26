import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { AttributionService } from '../../../core/services/attribution.service';

type AttributionHistoryItem = {
  _id: string;
  resourceType?: 'MATERIAL' | 'CONSUMABLE' | 'VEHICLE';
  resourceId?: string;
  snapshot?: {
    attribution?: {
      action?: string;
      quantity?: number;
      unit?: string;
      note?: string;
    };
    resourceAfter?: {
      name?: string;
      unit?: string;
      brand?: string;
      model?: string;
      plateNumber?: string;
    };
    timestamp?: string;
  };
  note?: string;
  createdAt?: string;
};

@Component({
  selector: 'app-technician-history',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './technician-history.html',
  styleUrls: ['./technician-history.scss']
})
export class TechnicianHistory {
  private attributionService = inject(AttributionService);
  private fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<AttributionHistoryItem[]>([]);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly total = signal(0);

  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    resourceType: this.fb.nonNullable.control(''),
    action: this.fb.nonNullable.control(''),
    quickRange: this.fb.nonNullable.control(''),
    from: this.fb.nonNullable.control(''),
    to: this.fb.nonNullable.control('')
  });

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    const f = this.filterForm.getRawValue();
    this.attributionService.listHistory({
      page: this.page(),
      limit: this.limit(),
      q: f.q.trim() || undefined,
      resourceType: f.resourceType || undefined,
      action: f.action || undefined,
      from: f.from || undefined,
      to: f.to || undefined
    }).subscribe({
      next: (res) => {
        const payload = res as { items?: AttributionHistoryItem[]; total?: number } | null;
        const items = payload?.items ?? [];
        this.items.set(items.filter((item: AttributionHistoryItem) => {
          const action = item.snapshot?.attribution?.action;
          return action === 'ATTRIBUTION' || action === 'REPRISE';
        }));
        this.total.set(payload?.total ?? items.length);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement historique');
      }
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.refresh();
  }

  applyQuickRange(): void {
    const value = this.filterForm.controls.quickRange.value;
    if (!value) {
      this.filterForm.patchValue({ from: '', to: '' });
      return;
    }
    const today = new Date();
    let from: Date;
    let to: Date;
    if (value === 'this-week') {
      const day = today.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      from = new Date(today);
      from.setDate(today.getDate() + diff);
      to = new Date(from);
      to.setDate(from.getDate() + 6);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    const fromValue = from.toISOString().slice(0, 10);
    const toValue = to.toISOString().slice(0, 10);
    this.filterForm.patchValue({ from: fromValue, to: toValue });
  }

  clearFilters(): void {
    this.filterForm.setValue({ q: '', resourceType: '', action: '', quickRange: '', from: '', to: '' });
    this.page.set(1);
    this.refresh();
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh();
  }

  nextPage(): void {
    if (!this.canNext()) return;
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

  actionLabel(item: AttributionHistoryItem): string {
    const action = item.snapshot?.attribution?.action;
    if (action === 'ATTRIBUTION') return 'Attribution';
    if (action === 'REPRISE') return 'Reprise';
    return action || '—';
  }

  actionClass(item: AttributionHistoryItem): string {
    const action = item.snapshot?.attribution?.action;
    if (action === 'ATTRIBUTION') return 'badge-assign';
    if (action === 'REPRISE') return 'badge-release';
    return '';
  }

  resourceLabel(item: AttributionHistoryItem): string {
    const resource = item.snapshot?.resourceAfter;
    if (item.resourceType === 'VEHICLE') {
      return [resource?.plateNumber, resource?.brand, resource?.model].filter(Boolean).join(' ') || '—';
    }
    return resource?.name || '—';
  }

  quantityLabel(item: AttributionHistoryItem): string {
    const qty = item.snapshot?.attribution?.quantity ?? 0;
    const unit = item.snapshot?.attribution?.unit || '';
    return unit ? `${qty} ${unit}` : String(qty);
  }

  noteLabel(item: AttributionHistoryItem): string {
    return item.snapshot?.attribution?.note || item.note || '—';
  }
}
