import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ChargeService } from '../../../core/services/charge.service';
import { TechnicianReportService } from '../../../core/services/technician-report.service';
import { Charge, ChargeType } from '../../../core/models';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';
import { apiError } from '../../../core/utils/http-error';
import { PaginationState } from '../../../core/utils/pagination-state';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';

type BenefitRow = {
  month: string;
  label: string;
  ca: number;
  charges: number;
  benefit: number;
};

@Component({
  selector: 'app-technician-charges',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal, ConfirmActionModal, TechnicianMobileNav],
  providers: [DatePipe],
  templateUrl: './technician-charges.html',
  styleUrl: './technician-charges.scss'
})
export class TechnicianCharges {
  private fb = inject(FormBuilder);
  private charges = inject(ChargeService);
  private reports = inject(TechnicianReportService);
  private datePipe = inject(DatePipe);

  private readonly pag = new PaginationState();
  readonly page = this.pag.page;
  readonly limit = this.pag.limit;
  readonly total = this.pag.total;
  readonly pageRange = this.pag.pageRange;
  readonly pageCount = this.pag.pageCount;
  readonly canPrev = this.pag.canPrev;
  readonly canNext = this.pag.canNext;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<Charge[]>([]);
  readonly editing = signal<Charge | null>(null);

  readonly deleteModalOpen = signal(false);
  readonly pendingDelete = signal<Charge | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly confirmUpdateOpen = signal(false);
  readonly pendingUpdatePayload = signal<{ type: ChargeType; amount: number; month: string; note?: string } | null>(null);

  readonly benefitLoading = signal(false);
  readonly benefitError = signal<string | null>(null);
  readonly benefitRows = signal<BenefitRow[]>([]);

  readonly periodStart = signal('');
  readonly periodEnd = signal('');
  readonly typeFilter = signal<ChargeType | ''>('');
  readonly selectedYear = signal(new Date().getFullYear());
  readonly selectedMonth = signal(this.currentMonth());

  readonly chargeTypes: Array<{ value: ChargeType; label: string }> = [
    { value: 'VEHICULE', label: 'Véhicule' },
    { value: 'LOYER', label: 'Loyer' },
    { value: 'ESSENCE', label: 'Essence' },
    { value: 'ASSURANCE', label: 'Assurance' },
    { value: 'MATERIEL', label: 'Matériels' },
    { value: 'CONSOMMABLE', label: 'Consommables' },
    { value: 'AUTRE', label: 'Autre' }
  ];

  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<ChargeType>('VEHICULE', [Validators.required]),
    month: this.fb.nonNullable.control(this.currentDateInput(), [Validators.required]),
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    note: this.fb.nonNullable.control('')
  });

  readonly monthlySummary = computed(() => {
    const month = this.selectedMonth();
    const row = this.benefitRows().find((r) => r.month === month);
    return {
      month,
      label: row?.label || this.monthLabel(month),
      ca: row?.ca || 0,
      charges: row?.charges || 0,
      benefit: row?.benefit || 0
    };
  });

  constructor() {
    this.loadCharges(true);
    this.loadBenefit(true);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const current = this.editing();
    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      month: this.dateInputToMonth(raw.month)
    };
    if (!payload.month) {
      this.form.controls.month.setErrors({ required: true });
      this.form.controls.month.markAsTouched();
      return;
    }
    if (current?._id) {
      this.pendingUpdatePayload.set(payload);
      this.confirmUpdateOpen.set(true);
      return;
    }
    this.runSave(payload, current?._id);
  }

  resetForm(): void {
    this.form.reset({ type: 'VEHICULE', month: this.currentDateInput(), amount: 0, note: '' });
    this.editing.set(null);
  }

  editCharge(item: Charge): void {
    this.editing.set(item);
    this.form.patchValue({
      type: item.type,
      month: this.monthToDateInput(item.month),
      amount: item.amount,
      note: item.note || ''
    });
  }

  closeConfirmUpdate(): void {
    this.confirmUpdateOpen.set(false);
    this.pendingUpdatePayload.set(null);
  }

  confirmUpdate(): void {
    const current = this.editing();
    const payload = this.pendingUpdatePayload();
    if (!current?._id || !payload) {
      this.closeConfirmUpdate();
      return;
    }
    this.closeConfirmUpdate();
    this.runSave(payload, current._id);
  }

  openDeleteModal(item: Charge): void {
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
    this.charges.remove(item._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
        this.loadCharges(true);
        this.loadBenefit(true);
      },
      error: (err) => {
        this.deletingId.set(null);
        this.error.set(apiError(err, 'Erreur suppression charge'));
      }
    });
  }

  private runSave(payload: { type: ChargeType; amount: number; month: string; note?: string }, id?: string): void {
    this.loading.set(true);
    this.error.set(null);
    const request$ = id ? this.charges.update(id, payload) : this.charges.create(payload);
    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.editing.set(null);
        this.resetForm();
        this.loadCharges(true);
        this.loadBenefit(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Erreur sauvegarde charge'));
      }
    });
  }

  setPeriodStart(value: string): void {
    this.periodStart.set(this.dateInputToMonth(value));
    this.page.set(1);
    this.loadCharges(true);
  }

  setPeriodEnd(value: string): void {
    this.periodEnd.set(this.dateInputToMonth(value));
    this.page.set(1);
    this.loadCharges(true);
  }

  setTypeFilter(value: string): void {
    this.typeFilter.set(value as ChargeType | '');
    this.page.set(1);
    this.loadCharges(true);
  }

  prevPage(): void { this.pag.prevPage(() => this.loadCharges(true)); }
  nextPage(): void { this.pag.nextPage(() => this.loadCharges(true)); }
  setLimitValue(v: number): void { this.pag.setLimitValue(v, () => this.loadCharges(true)); }

  setMonthSelection(value: string): void {
    const raw = this.dateInputToMonth(value);
    if (!raw) return;
    this.selectedMonth.set(raw);
    const parts = raw.split('-').map(Number);
    if (parts.length === 2 && Number.isFinite(parts[0])) {
      const year = parts[0];
      if (year !== this.selectedYear()) {
        this.selectedYear.set(year);
        this.loadBenefit(true);
      }
    }
  }

  loadCharges(force = false): void {
    if (!force && this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    const start = this.normalizePeriod(this.periodStart());
    const end = this.normalizePeriod(this.periodEnd());
    const type = this.typeFilter() || undefined;
    if (start || end) {
      this.loadChargesByPeriod({ type, start, end });
      return;
    }
    this.charges.listMine({ page: this.page(), limit: this.limit(), type }).subscribe({
      next: (res) => {
        const data = res?.data;
        this.items.set(data?.items || []);
        this.total.set(data?.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Erreur chargement charges'));
      }
    });
  }

  loadBenefit(force = false): void {
    if (!force && this.benefitLoading()) return;
    this.benefitLoading.set(true);
    this.benefitError.set(null);
    const year = this.selectedYear();
    forkJoin({
      charges: this.charges.summaryMineByMonth(year),
      ca: this.reports.summaryByMonth({ year })
    }).subscribe({
      next: (res) => {
        const chargeMap = new Map<string, number>();
        const caMap = new Map<string, number>();
        for (const row of res.charges.data.months || []) {
          chargeMap.set(row.month, Number(row.totalAmount || 0));
        }
        for (const row of res.ca.data.months || []) {
          caMap.set(row.month, Number(row.totalAmount || 0));
        }
        const rows: BenefitRow[] = [];
        for (let m = 1; m <= 12; m += 1) {
          const month = `${year}-${String(m).padStart(2, '0')}`;
          const ca = caMap.get(month) || 0;
          const charges = chargeMap.get(month) || 0;
          rows.push({
            month,
            label: this.monthLabel(month),
            ca,
            charges,
            benefit: ca - charges
          });
        }
        this.benefitRows.set(rows);
        this.benefitLoading.set(false);
      },
      error: (err) => {
        this.benefitLoading.set(false);
        this.benefitError.set(apiError(err, 'Erreur chargement bénéfice'));
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

  chargeTypeLabel(type?: ChargeType | string | null): string {
    const key = String(type || '').toUpperCase();
    const match = this.chargeTypes.find((t) => t.value === key);
    return match?.label || (key ? key : '—');
  }

  hasActivePeriodFilter(): boolean {
    return !!(this.periodStart() || this.periodEnd());
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private currentDateInput(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private monthToDateInput(month: string): string {
    const normalized = this.normalizePeriod(month);
    return normalized ? `${normalized}-01` : '';
  }

  private dateInputToMonth(value: string): string {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw.slice(0, 7);
    }
    return this.normalizePeriod(raw);
  }

  private loadChargesByPeriod(params: { type?: ChargeType; start?: string; end?: string }): void {
    const pageSize = 100;
    this.charges.listMine({ page: 1, limit: pageSize, type: params.type }).subscribe({
      next: (res) => {
        const firstPage = res?.data;
        const firstItems = firstPage?.items || [];
        const total = firstPage?.total || 0;
        const pageCount = Math.ceil(total / pageSize);
        if (pageCount <= 1) {
          this.applyPeriodPagination(firstItems, params.start, params.end);
          return;
        }
        const remainingRequests = Array.from({ length: pageCount - 1 }, (_, index) =>
          this.charges.listMine({ page: index + 2, limit: pageSize, type: params.type })
        );
        forkJoin(remainingRequests).subscribe({
          next: (responses) => {
            const allItems = [
              ...firstItems,
              ...responses.flatMap((response) => response?.data?.items || [])
            ];
            this.applyPeriodPagination(allItems, params.start, params.end);
          },
          error: (err) => {
            this.loading.set(false);
            this.error.set(apiError(err, 'Erreur chargement charges'));
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Erreur chargement charges'));
      }
    });
  }

  private applyPeriodPagination(items: Charge[], start?: string, end?: string): void {
    const filtered = items.filter((item) => this.isMonthWithinPeriod(item.month, start, end));
    const total = filtered.length;
    const currentPage = this.page();
    const limit = this.limit();
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(currentPage, lastPage);
    if (safePage !== currentPage) {
      this.page.set(safePage);
    }
    const startIndex = (safePage - 1) * limit;
    this.items.set(filtered.slice(startIndex, startIndex + limit));
    this.total.set(total);
    this.loading.set(false);
  }

  private isMonthWithinPeriod(month: string, start?: string, end?: string): boolean {
    const value = this.normalizePeriod(month);
    if (!value) return false;
    const safeStart = start && end && start > end ? end : start;
    const safeEnd = start && end && start > end ? start : end;
    if (safeStart && value < safeStart) return false;
    if (safeEnd && value > safeEnd) return false;
    return true;
  }

  private normalizePeriod(value: string): string {
    const raw = String(value || '').trim();
    return /^\d{4}-\d{2}$/.test(raw) ? raw : '';
  }

  private monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    return this.datePipe.transform(new Date(y, m - 1, 1), 'MMM yyyy') || month;
  }

}
