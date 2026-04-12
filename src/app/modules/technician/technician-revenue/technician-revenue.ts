import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TechnicianReport, TechnicianReportService } from '../../../core/services/technician-report.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatPageRange } from '../../../core/utils/pagination';
import { BpuSelection } from '../../../core/models';
import { formatFrDate } from '../../../core/utils/date-format';
import { computeReportAmount, normalizeReportPrestations } from '../../../core/utils/technician-report-utils';
import { TechnicianBpuResolverService } from '../../../core/services/technician-bpu-resolver.service';
import { ReportPrestationsBadges } from '../../../shared/components/report-prestations-badges/report-prestations-badges';
import { AmountCurrencyPipe, formatAmountCurrency } from '../../../shared/pipes/amount-currency.pipe';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { preferredPageSize } from '../../../core/utils/page-size';

@Component({
  selector: 'app-technician-revenue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TechnicianMobileNav, ConfirmDeleteModal, ReportPrestationsBadges, AmountCurrencyPipe],
  providers: [DatePipe],
  templateUrl: './technician-revenue.html',
  styleUrl: './technician-revenue.scss'
})
export class TechnicianRevenue {
  private fb = inject(FormBuilder);
  private reports = inject(TechnicianReportService);
  private auth = inject(AuthService);
  private datePipe = inject(DatePipe);
  private bpuResolver = inject(TechnicianBpuResolverService);

  readonly summaryLoading = signal(false);
  readonly summaryError = signal<string | null>(null);
  readonly dailyAmount = signal(0);
  readonly weeklyAmount = signal(0);
  readonly monthlyAmount = signal(0);
  readonly todayLabel = computed(() => formatFrDate(new Date()));
  readonly bpuLoading = signal(false);
  readonly bpuError = signal<string | null>(null);
  readonly bpuSelections = signal<BpuSelection[]>([]);
  readonly usesPersonalizedBpu = signal(false);
  readonly hasPersonalizedBpu = computed(() => this.usesPersonalizedBpu());
  readonly bpuPrices = signal<Map<string, number>>(new Map());

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly deleteModalOpen = signal(false);
  readonly deleteTarget = signal<TechnicianReport | null>(null);
  readonly items = signal<TechnicianReport[]>([]);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly total = signal(0);
  readonly pageRange = formatPageRange;
  readonly listTotalAmount = computed(() =>
    this.items().reduce((sum, item) => sum + this.computeAmount(item), 0)
  );
  readonly prestationCounts = computed(() => {
    const counts = new Map<string, { code: string; qty: number }>();
    for (const report of this.items()) {
      for (const item of this.prestationsSummary(report)) {
        const code = String(item.code || '').toUpperCase();
        if (!code || item.qty <= 0) continue;
        const current = counts.get(code);
        if (current) {
          current.qty += item.qty;
        } else {
          counts.set(code, { code, qty: item.qty });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.qty - a.qty || a.code.localeCompare(b.code));
  });

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly filterForm = this.fb.nonNullable.group({
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  constructor() {
    this.loadBpuInfo();
    this.loadSummary();
    this.refresh(true);
  }

  applyFilters(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearFilters(): void {
    this.filterForm.reset({ fromDate: '', toDate: '' });
    this.page.set(1);
    this.refresh(true);
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh(true);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.refresh(true);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh(true);
  }

  refresh(force = false): void {
    if (!force && this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    const filters = this.filterForm.getRawValue();
    const userId = this.currentUserId();
    this.reports.list({
      page: this.page(),
      limit: this.limit(),
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      technicianId: userId || undefined
    }).subscribe({
      next: (res) => {
        this.items.set(res.data.items || []);
        this.total.set(res.data.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.message || 'Erreur chargement CA');
      }
    });
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    const userId = this.currentUserId();
    this.reports.summaryPeriods(userId || undefined).subscribe({
      next: (res) => {
        this.dailyAmount.set(res.daily.data.totalAmount || 0);
        this.weeklyAmount.set(res.weekly.data.totalAmount || 0);
        this.monthlyAmount.set(res.monthly.data.totalAmount || 0);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
        this.summaryError.set('Erreur chargement résumé CA');
      }
    });
  }

  loadBpuInfo(): void {
    this.bpuLoading.set(true);
    this.bpuError.set(null);
    this.resolveBpuPrices$().subscribe({
      next: ({ selections, prices, usesPersonalizedBpu }) => {
        this.bpuSelections.set(selections);
        this.bpuPrices.set(prices);
        this.usesPersonalizedBpu.set(usesPersonalizedBpu);
        this.bpuLoading.set(false);
      },
      error: () => {
        this.bpuSelections.set([]);
        this.bpuPrices.set(new Map());
        this.usesPersonalizedBpu.set(false);
        this.bpuLoading.set(false);
        this.bpuError.set('Erreur chargement BPU');
      }
    });
  }

  computeAmount(report: TechnicianReport): number {
    return computeReportAmount(report, this.bpuPrices());
  }

  reportDateLabel(report: TechnicianReport): string {
    return this.datePipe.transform(report.reportDate, 'shortDate') || '—';
  }

  prestationsSummary(report: TechnicianReport): Array<{ code: string; qty: number }> {
    return normalizeReportPrestations(report).map(({ code, qty }) => ({ code, qty }));
  }

  private currentUserId(): string | null {
    const user = this.auth.getCurrentUser();
    if (!user?._id) return null;
    return String(user._id);
  }

  openDeleteModal(item: TechnicianReport): void {
    if (!item._id) return;
    this.deleteTarget.set(item);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const item = this.deleteTarget();
    const id = item?._id;
    if (!id) return;
    this.deletingId.set(id);
    this.deleteError.set(null);
    this.reports.remove(id).subscribe({
      next: () => {
        this.refresh(true);
        this.deletingId.set(null);
        this.closeDeleteModal();
      },
      error: (err) => {
        this.deleteError.set(err?.error?.message || 'Erreur lors de la suppression.');
        this.deletingId.set(null);
        this.closeDeleteModal();
      }
    });
  }

  deleteQuestion = computed(() => {
    const item = this.deleteTarget();
    if (!item) return '';
    const amount = formatAmountCurrency(this.computeAmount(item));
    return `Supprimer le rapport du ${this.reportDateLabel(item)} (${amount}) ?`;
  });

  private resolveBpuPrices$(): Observable<{ selections: BpuSelection[]; prices: Map<string, number>; usesPersonalizedBpu: boolean }> {
    return this.bpuResolver.resolve(this.currentUserId()).pipe(
      map((state) => ({
        selections: state.selections,
        prices: state.prices,
        usesPersonalizedBpu: state.usesPersonalizedBpu
      }))
    );
  }
}
