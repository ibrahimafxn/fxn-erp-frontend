import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RevenueService, RevenueItem, RevenueSummaryPoint, RevenueUser } from '../../../core/services/revenue.service';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  selector: 'app-revenue-dashboard',
  imports: [CommonModule, ReactiveFormsModule, DatePipe, ConfirmDeleteModal],
  templateUrl: './revenue-dashboard.html',
  styleUrls: ['./revenue-dashboard.scss']
})
export class RevenueDashboard {
  private revenue = inject(RevenueService);
  private fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<RevenueItem[]>([]);
  readonly total = signal(0);
  readonly series = signal<RevenueSummaryPoint[]>([]);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly totalCount = signal(0);
  readonly pageCount = computed(() => {
    const t = this.totalCount();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly editing = signal<RevenueItem | null>(null);
  readonly deleteModalOpen = signal(false);
  readonly pendingDelete = signal<RevenueItem | null>(null);
  readonly deleting = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    month: this.fb.nonNullable.control(''),
    year: this.fb.nonNullable.control('')
  });

  readonly createForm = this.fb.nonNullable.group({
    month: this.fb.nonNullable.control('', [Validators.required]),
    year: this.fb.nonNullable.control('', [Validators.required]),
    amountHt: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    note: this.fb.nonNullable.control('')
  });

  readonly maxAmount = computed(() => {
    const values = this.series().map((s) => s.amountHt || 0);
    const max = Math.max(...values, 0);
    return max || 1;
  });

  readonly maxCumulative = computed(() => {
    const values = this.series().map((s) => s.cumulativeHt || 0);
    const max = Math.max(...values, 0);
    return max || 1;
  });

  constructor() {
    this.loadAll();
  }

  readonly yearOptions = computed(() => {
    const current = new Date().getFullYear();
    const start = current - 5;
    const end = current + 2;
    const years: number[] = [];
    for (let y = start; y <= end; y += 1) years.push(y);
    return years;
  });

  readonly monthOptions = computed(() => ([
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' }
  ]));

  loadAll(): void {
    const { month, year } = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    const monthKey = this.buildMonthKey(month, year);
    const fromMonth = monthKey || undefined;
    const toMonth = monthKey || undefined;
    const monthNumber = month ? Number(month) : 0;
    const yearNumber = year ? Number(year) : 0;
    const monthOnly = monthNumber && !yearNumber;

    this.revenue.list({
      from: monthOnly ? undefined : fromMonth || undefined,
      to: monthOnly ? undefined : toMonth || undefined,
      month: monthOnly ? monthNumber : undefined,
      year: yearNumber || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur chargement CA');
          this.loading.set(false);
          return;
        }
        this.items.set(res.data.items || []);
        this.total.set(res.data.total || 0);
        this.totalCount.set(res.data.totalCount || 0);
        this.loadSummary();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement CA');
      }
    });
  }

  loadSummary(): void {
    const { month, year } = this.filterForm.getRawValue();
    const monthKey = this.buildMonthKey(month, year);
    const fromMonth = monthKey || undefined;
    const toMonth = monthKey || undefined;
    const monthNumber = month ? Number(month) : 0;
    const yearNumber = year ? Number(year) : 0;
    const monthOnly = monthNumber && !yearNumber;
    this.revenue.summary({
      from: monthOnly ? undefined : fromMonth || undefined,
      to: monthOnly ? undefined : toMonth || undefined,
      month: monthOnly ? monthNumber : undefined,
      year: yearNumber || undefined
    }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur synthèse CA');
          this.loading.set(false);
          return;
        }
        this.series.set(res.data.series || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur synthèse CA');
      }
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadAll();
  }

  clearFilters(): void {
    this.filterForm.setValue({ month: '', year: '' });
    this.page.set(1);
    this.loadAll();
  }

  submit(): void {
    if (this.createForm.invalid) return;
    const raw = this.createForm.getRawValue();
    const year = Number(raw.year);
    const month = Number(raw.month);
    if (!year || !month) {
      this.error.set('Période invalide.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const payload = {
      year,
      month,
      amountHt: Number(raw.amountHt),
      note: raw.note?.trim() || undefined
    };

    const editing = this.editing();
    const request$ = editing
      ? this.revenue.update(editing._id, payload)
      : this.revenue.upsert(payload);

    request$.subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur sauvegarde CA');
          this.loading.set(false);
          return;
        }
        this.createForm.reset({ month: '', amountHt: 0, note: '' });
        this.editing.set(null);
        this.loadAll();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur sauvegarde CA');
      }
    });
  }

  openDeleteModal(item: RevenueItem): void {
    this.pendingDelete.set(item);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) return;
    this.deleting.set(true);
    this.error.set(null);
    this.revenue.remove(item._id).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur suppression CA');
          this.deleting.set(false);
          return;
        }
        this.deleting.set(false);
        this.closeDeleteModal();
        this.loadAll();
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err?.error?.message || 'Erreur suppression CA');
      }
    });
  }

  formatMonth(item: RevenueItem | RevenueSummaryPoint): string {
    const month = String(item.month).padStart(2, '0');
    return `${item.year}-${month}`;
  }

  authorLabel(user?: RevenueUser | null): string {
    if (!user) return '—';
    const first = user.firstName || '';
    const last = user.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || user.email || '—';
  }

  startEdit(item: RevenueItem): void {
    this.createForm.setValue({
      month: String(item.month).padStart(2, '0'),
      year: String(item.year),
      amountHt: Number(item.amountHt || 0),
      note: item.note || ''
    });
    this.editing.set(item);
  }

  cancelEdit(): void {
    this.createForm.reset({ month: '', year: '', amountHt: 0, note: '' });
    this.editing.set(null);
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.loadAll();
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.loadAll();
  }

  setLimit(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.limit.set(v);
    this.page.set(1);
    this.loadAll();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
      .format(value || 0);
  }

  private buildMonthKey(month: string, year: string): string {
    const monthValue = String(month || '').padStart(2, '0');
    const yearValue = String(year || '').trim();
    if (!monthValue || !yearValue) return '';
    return `${yearValue}-${monthValue}`;
  }
}
