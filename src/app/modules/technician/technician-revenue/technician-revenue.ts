import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TechnicianReport, TechnicianReportService } from '../../../core/services/technician-report.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatPageRange } from '../../../core/utils/pagination';

@Component({
  selector: 'app-technician-revenue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  templateUrl: './technician-revenue.html',
  styleUrl: './technician-revenue.scss'
})
export class TechnicianRevenue {
  private fb = inject(FormBuilder);
  private reports = inject(TechnicianReportService);
  private auth = inject(AuthService);
  private datePipe = inject(DatePipe);

  readonly summaryLoading = signal(false);
  readonly summaryError = signal<string | null>(null);
  readonly dailyAmount = signal(0);
  readonly weeklyAmount = signal(0);
  readonly monthlyAmount = signal(0);
  readonly todayLabel = computed(() => new Date().toLocaleDateString('fr-FR'));

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<TechnicianReport[]>([]);
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly total = signal(0);
  readonly pageRange = formatPageRange;
  readonly listTotalAmount = computed(() =>
    this.items().reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );

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
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = this.startOfWeek(dayStart);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const fmt = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const userId = this.currentUserId();
    const toDate = fmt(dayStart);

    forkJoin({
      daily: this.reports.summary({ fromDate: fmt(dayStart), toDate, technicianId: userId || undefined }),
      weekly: this.reports.summary({ fromDate: fmt(weekStart), toDate, technicianId: userId || undefined }),
      monthly: this.reports.summary({ fromDate: fmt(monthStart), toDate, technicianId: userId || undefined })
    }).subscribe({
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

  formatAmount(value?: number | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  reportDateLabel(report: TechnicianReport): string {
    return this.datePipe.transform(report.reportDate, 'shortDate') || '—';
  }

  interventionsLabel(report: TechnicianReport): string {
    const p = report.prestations || {};
    const total =
      Number(p.professionnel || 0) +
      Number(p.pavillon || 0) +
      Number(p.immeuble || 0) +
      Number(p.racProC || 0) +
      Number(p.prestaComplementaire || 0) +
      Number(p.reconnexion || 0) +
      Number(p.sav || 0) +
      Number(p.prestationF8 || 0);
    return total > 0 ? String(total) : '0';
  }

  private currentUserId(): string | null {
    const user = this.auth.getCurrentUser();
    if (!user?._id) return null;
    return String(user._id);
  }

  private startOfWeek(date: Date): Date {
    const day = (date.getDay() + 6) % 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
  }
}
