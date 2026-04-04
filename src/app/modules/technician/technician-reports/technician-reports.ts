import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TechnicianReportService, TechnicianReport } from '../../../core/services/technician-report.service';
import { formatPageRange } from '../../../core/utils/pagination';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';

@Component({
  selector: 'app-technician-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal, TechnicianMobileNav],
  providers: [DatePipe],
  templateUrl: './technician-reports.html',
  styleUrl: './technician-reports.scss'
})
export class TechnicianReports {
  private fb = inject(FormBuilder);
  private reportService = inject(TechnicianReportService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveSuccess = signal(false);
  readonly filtersOpen = signal(false);

  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }
  readonly items = signal<TechnicianReport[]>([]);
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly total = signal(0);
  readonly pageRange = formatPageRange;
  readonly editing = signal<TechnicianReport | null>(null);
  readonly deleteModalOpen = signal(false);
  readonly pendingDelete = signal<TechnicianReport | null>(null);
  readonly deletingId = signal<string | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    year: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly todayReport = computed(() => {
    const todayKey = this.todayInput();
    return (
      this.items().find(
        (report) => (this.datePipe.transform(report.reportDate, 'yyyy-MM-dd') || '') === todayKey
      ) || null
    );
  });
  readonly todayComplexProCount = computed(() => Number(this.todayReport()?.prestations?.racProC ?? 0));

  readonly form = this.fb.nonNullable.group({
    date: this.fb.nonNullable.control(this.todayInput(), [Validators.required]),
    prestations: this.fb.nonNullable.group({
      professionnel: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      pavillon: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      aerien: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      facade: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      immeuble: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      racProC: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      prestaComplementaire: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      reconnexion: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      deplacementOffert: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      deplacementATort: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      swapEquipement: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      savExp: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
      prestationF8: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)])
    }),
    comment: this.fb.nonNullable.control('')
  });

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly initialFormValue = signal('');
  readonly formSnapshot = signal('');
  readonly isDefaultForm = computed(
    () => this.formSnapshot() === this.initialFormValue()
  );
  readonly prestationOptions = [
    { key: 'professionnel', label: 'Pro simple', className: 'pill-professionnel' },
    { key: 'racProC', label: 'Pro complexe', className: 'pill-pro-c' },
    { key: 'immeuble', label: 'Immeuble', className: 'pill-immeuble' },
    { key: 'pavillon', label: 'Pavillon sout.', className: 'pill-pavillon' },
    { key: 'aerien', label: 'Aérien', className: 'pill-aerien' },
    { key: 'facade', label: 'Façade', className: 'pill-facade' },
    { key: 'prestaComplementaire', label: 'Complémentaire', className: 'pill-complementaire' },
    { key: 'reconnexion', label: 'Reconnexion', className: 'pill-reconnexion' },
    { key: 'deplacementOffert', label: 'Dépl. offert', className: 'pill-depl-offert' },
    { key: 'deplacementATort', label: 'Dépl. à tort', className: 'pill-depl-tort' },
    { key: 'swapEquipement', label: 'Swap équip.', className: 'pill-swap' },
    { key: 'savExp', label: 'SAV EXP', className: 'pill-sav-exp' },
    { key: 'prestationF8', label: 'Fourreau cassé', className: 'pill-f8' }
  ] as const;

  constructor() {
    this.refresh(true);
    this.initialFormValue.set(this.serializeForm(this.form.getRawValue()));
    this.formSnapshot.set(this.serializeForm(this.form.getRawValue()));
    this.form.valueChanges.subscribe(() => {
      this.formSnapshot.set(this.serializeForm(this.form.getRawValue()));
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    const current = this.editing();
    const request$ = current?._id
      ? this.reportService.update(current._id, payload)
      : this.reportService.create(payload);
    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.editing.set(null);
        this.resetForm();
        this.refresh(true);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 2500);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, "Erreur d'enregistrement"));
      }
    });
  }

  editToday(report: TechnicianReport): void {
    const date = this.datePipe.transform(report.reportDate, 'yyyy-MM-dd') || this.todayInput();
    this.editing.set(report);
    this.form.patchValue({
      date,
      prestations: {
        professionnel: report.prestations?.professionnel ?? 0,
        pavillon: report.prestations?.pavillon ?? 0,
        aerien: report.prestations?.aerien ?? 0,
        facade: report.prestations?.facade ?? 0,
        immeuble: report.prestations?.immeuble ?? 0,
        racProC: report.prestations?.racProC ?? 0,
        prestaComplementaire: report.prestations?.prestaComplementaire ?? 0,
        reconnexion: report.prestations?.reconnexion ?? 0,
        deplacementOffert: report.prestations?.deplacementOffert ?? 0,
        deplacementATort: report.prestations?.deplacementATort ?? 0,
        swapEquipement: report.prestations?.swapEquipement ?? 0,
        savExp: report.prestations?.savExp ?? 0,
        prestationF8: report.prestations?.prestationF8 ?? 0
      },
      comment: report.comment || ''
    });
    this.initialFormValue.set(this.serializeForm(this.form.getRawValue()));
    this.formSnapshot.set(this.serializeForm(this.form.getRawValue()));
    this.form.markAsPristine();
  }

  openDeleteModal(report: TechnicianReport): void {
    this.pendingDelete.set(report);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const report = this.pendingDelete();
    if (!report?._id) return;
    this.deletingId.set(report._id);
    this.reportService.remove(report._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
        this.refresh(true);
      },
      error: (err) => {
        this.deletingId.set(null);
        this.error.set(this.apiError(err, 'Erreur suppression'));
      }
    });
  }

  isToday(report: TechnicianReport): boolean {
    const today = this.todayInput();
    const reportDay = this.datePipe.transform(report.reportDate, 'yyyy-MM-dd');
    return reportDay === today;
  }

  prestationsSummary(report: TechnicianReport): Array<{ key: string; label: string; value: number; className: string }> {
    const p = report.prestations || {};
    return this.prestationOptions
      .map((option) => ({
        key: option.key,
        label: option.label,
        value: Number(p[option.key] || 0),
        className: option.className
      }))
      .filter((item) => item.value > 0);
  }

  refresh(force = false): void {
    this.loading.set(true);
    this.error.set(null);
    const filters = this.filterForm.getRawValue();
    const range = this.normalizeDateRange(filters.year, filters.fromDate, filters.toDate);
    this.reportService.list({
      page: this.page(),
      limit: this.limit(),
      fromDate: range.fromDate || undefined,
      toDate: range.toDate || undefined
    }).subscribe({
      next: (res) => {
        this.items.set(res.data.items || []);
        this.total.set(res.data.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement'));
      }
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearFilters(): void {
    this.filterForm.reset({ year: '', fromDate: '', toDate: '' });
    this.page.set(1);
    this.refresh(true);
  }

  setLimit(event: Event): void {
    const el = event.target as HTMLSelectElement | null;
    if (!el) return;
    const value = Number(el.value);
    if (!Number.isFinite(value) || value <= 0) return;
    this.setLimitValue(value);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
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

  private todayInput(): string {
    return this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
  }

  private resetForm(): void {
    this.form.reset({
      date: this.todayInput(),
      prestations: {
        professionnel: 0,
        pavillon: 0,
        aerien: 0,
        facade: 0,
        immeuble: 0,
        racProC: 0,
        prestaComplementaire: 0,
        reconnexion: 0,
        deplacementOffert: 0,
        deplacementATort: 0,
        swapEquipement: 0,
        savExp: 0,
        prestationF8: 0
      },
      comment: ''
    });
    this.initialFormValue.set(this.serializeForm(this.form.getRawValue()));
    this.formSnapshot.set(this.serializeForm(this.form.getRawValue()));
    this.form.markAsPristine();
  }

  private normalizeDateRange(yearInput: string, fromInput: string, toInput: string): { fromDate: string; toDate: string } {
    const year = Number(yearInput);
    if (Number.isFinite(year) && year >= 2000) {
      const fromDate = fromInput || `${year}-01-01`;
      const toDate = toInput || `${year}-12-31`;
      return { fromDate, toDate };
    }
    return { fromDate: fromInput || '', toDate: toInput || '' };
  }

  prestationStyle(key: string): Record<string, string> {
    switch (key) {
      case 'pavillon':
        return {
          borderColor: 'rgba(59, 130, 246, 0.95)',
          background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.9), rgba(59, 130, 246, 0.65))',
          color: '#eff6ff'
        };
      case 'aerien':
        return {
          borderColor: 'rgba(56, 189, 248, 0.95)',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.85), rgba(56, 189, 248, 0.6))',
          color: '#e0f2fe'
        };
      case 'facade':
        return {
          borderColor: 'rgba(249, 115, 22, 0.95)',
          background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.85), rgba(249, 115, 22, 0.65))',
          color: '#fff7ed'
        };
      case 'professionnel':
        return {
          borderColor: 'rgba(239, 68, 68, 0.9)',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.8), rgba(239, 68, 68, 0.7))',
          color: '#fff1f2'
        };
      case 'racProC':
        return {
          borderColor: 'rgba(59, 130, 246, 0.9)',
          background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.85), rgba(59, 130, 246, 0.7))',
          color: '#eff6ff'
        };
      case 'prestaComplementaire':
        return {
          borderColor: 'rgba(34, 197, 94, 0.85)',
          background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.8), rgba(148, 163, 184, 0.6))',
          color: '#f0fdf4'
        };
      case 'reconnexion':
        return {
          borderColor: 'rgba(136, 19, 55, 0.95)',
          background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.9), rgba(136, 19, 55, 0.75))',
          color: '#ffe4e6'
        };
      case 'immeuble':
        return {
          borderColor: 'rgba(34, 211, 238, 0.95)',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(14, 116, 144, 0.75))',
          color: '#ecfeff'
        };
      case 'deplacementOffert':
        return {
          borderColor: 'rgba(34, 197, 94, 0.95)',
          background: 'linear-gradient(135deg, rgba(21, 128, 61, 0.85), rgba(74, 222, 128, 0.6))',
          color: '#dcfce7'
        };
      case 'deplacementATort':
        return {
          borderColor: 'rgba(239, 68, 68, 0.95)',
          background: 'linear-gradient(135deg, rgba(185, 28, 28, 0.9), rgba(239, 68, 68, 0.7))',
          color: '#fee2e2'
        };
      case 'swapEquipement':
        return {
          borderColor: 'rgba(168, 85, 247, 0.95)',
          background: 'linear-gradient(135deg, rgba(126, 34, 206, 0.85), rgba(168, 85, 247, 0.65))',
          color: '#f5f3ff'
        };
      case 'savExp':
        return {
          borderColor: 'rgba(148, 163, 184, 0.95)',
          background: 'linear-gradient(135deg, rgba(71, 85, 105, 0.9), rgba(100, 116, 139, 0.75))',
          color: '#f1f5f9'
        };
      case 'sav':
        return {
          borderColor: 'rgba(148, 163, 184, 0.7)',
          background: 'linear-gradient(135deg, rgba(51, 65, 85, 0.8), rgba(71, 85, 105, 0.6))',
          color: '#cbd5e1'
        };
      case 'prestationF8':
        return {
          borderColor: 'rgba(245, 158, 11, 0.95)',
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.9), rgba(180, 83, 9, 0.75))',
          color: '#fffbeb'
        };
      default:
        return {};
    }
  }

  stepPrestation(key: string, delta: number): void {
    const group = this.form.get('prestations') as FormGroup;
    const ctrl = group?.get(key);
    if (!ctrl) return;
    ctrl.setValue(Math.max(0, Number(ctrl.value ?? 0) + delta));
  }

  private apiError(err: any, fallback: string): string {
    const apiMsg =
      typeof err?.error === 'object' && err.error !== null && 'message' in err.error
        ? String(err.error.message ?? '')
        : '';
    return apiMsg || err?.message || fallback;
  }

  private serializeForm(value: unknown): string {
    return JSON.stringify(value ?? {});
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
}
