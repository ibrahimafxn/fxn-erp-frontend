import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ChargeService } from '../../../core/services/charge.service';
import { TechnicianReportService } from '../../../core/services/technician-report.service';
import { Charge, ChargeType } from '../../../core/models';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';
import { formatPageRange } from '../../../core/utils/pagination';

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
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal, ConfirmActionModal],
  providers: [DatePipe],
  templateUrl: './technician-charges.html',
  styleUrl: './technician-charges.scss'
})
export class TechnicianCharges {
  private fb = inject(FormBuilder);
  private charges = inject(ChargeService);
  private reports = inject(TechnicianReportService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<Charge[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly pageRange = formatPageRange;
  readonly editing = signal<Charge | null>(null);

  readonly deleteModalOpen = signal(false);
  readonly pendingDelete = signal<Charge | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly confirmUpdateOpen = signal(false);
  readonly pendingUpdatePayload = signal<{ type: ChargeType; amount: number; month: string; note?: string } | null>(null);

  readonly benefitLoading = signal(false);
  readonly benefitError = signal<string | null>(null);
  readonly benefitRows = signal<BenefitRow[]>([]);

  readonly monthFilter = signal('');
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
    month: this.fb.nonNullable.control(this.currentMonth(), [Validators.required]),
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    note: this.fb.nonNullable.control('')
  });

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

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
    const payload = this.form.getRawValue();
    if (current?._id) {
      this.pendingUpdatePayload.set(payload);
      this.confirmUpdateOpen.set(true);
      return;
    }
    this.runSave(payload, current?._id);
  }

  resetForm(): void {
    this.form.reset({ type: 'VEHICULE', month: this.currentMonth(), amount: 0, note: '' });
    this.editing.set(null);
  }

  editCharge(item: Charge): void {
    this.editing.set(item);
    this.form.patchValue({
      type: item.type,
      month: item.month,
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
        this.error.set(this.apiError(err, 'Erreur suppression charge'));
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
        this.error.set(this.apiError(err, 'Erreur sauvegarde charge'));
      }
    });
  }

  setMonthFilter(value: string): void {
    this.monthFilter.set(value);
    this.page.set(1);
    this.loadCharges(true);
  }

  setTypeFilter(value: string): void {
    this.typeFilter.set(value as ChargeType | '');
    this.page.set(1);
    this.loadCharges(true);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.loadCharges(true);
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.update(v => v - 1);
    this.loadCharges(true);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.update(v => v + 1);
    this.loadCharges(true);
  }

  setMonthSelection(value: string): void {
    const raw = String(value || '').trim();
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
    this.charges.listMine({
      page: this.page(),
      limit: this.limit(),
      month: this.monthFilter() || undefined,
      type: this.typeFilter() || undefined
    }).subscribe({
      next: (res) => {
        const data = res?.data;
        this.items.set(data?.items || []);
        this.total.set(data?.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement charges'));
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
        this.benefitError.set(this.apiError(err, 'Erreur chargement bénéfice'));
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

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    return this.datePipe.transform(new Date(y, m - 1, 1), 'MMM yyyy') || month;
  }

  private apiError(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
  }
}
