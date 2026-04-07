import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { TechnicianReportService, TechnicianReport } from '../../../core/services/technician-report.service';
import { BpuService } from '../../../core/services/bpu.service';
import { BpuSelectionService } from '../../../core/services/bpu-selection.service';
import { BpuEntry, BpuSelection } from '../../../core/models';
import { formatPageRange } from '../../../core/utils/pagination';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';

type BpuItem = { code: string; prestation: string };

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
  private bpuService = inject(BpuService);
  private bpuSelectionService = inject(BpuSelectionService);
  private datePipe = inject(DatePipe);

  // ── BPU dynamique ──────────────────────────────────────────────────────────
  readonly bpuLoading = signal(false);
  readonly bpuError = signal<string | null>(null);
  /** true dès que le technicien a au moins une prestation attribuée par l'admin */
  readonly hasBpu = signal(false);
  /** Prestations disponibles pour ce technicien (depuis sa BpuSelection) */
  readonly bpuItems = signal<BpuItem[]>([]);
  /** Prix unitaires de la BpuSelection active : Map<CODE, unitPrice> */
  readonly bpuPrices = signal<Map<string, number>>(new Map());
  /** Quantités saisies : Map<code, qty> */
  readonly qtys = signal<Map<string, number>>(new Map());

  // ── Liste / pagination ─────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveSuccess = signal(false);
  readonly filtersOpen = signal(false);

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

  readonly form = this.fb.nonNullable.group({
    date: this.fb.nonNullable.control(this.todayInput(), [Validators.required]),
    comment: this.fb.nonNullable.control('')
  });

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly isDefaultForm = computed(() => {
    const hasQtys = Array.from(this.qtys().values()).some((v) => v > 0);
    return !hasQtys && !this.form.get('comment')?.value;
  });

  constructor() {
    this.loadBpu();
    this.refresh(true);
  }

  // ── Chargement BPU ─────────────────────────────────────────────────────────

  loadBpu(): void {
    this.bpuLoading.set(true);
    this.bpuError.set(null);

    this.bpuSelectionService.list().pipe(
      switchMap((selections: BpuSelection[]) => {
        // Utiliser la sélection la plus récente (une seule active par technicien)
        const sorted = [...selections].sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        const active = sorted[0] ?? null;
        const allowedCodes = new Set(
          (active?.prestations || []).map((p) => String(p.code || '').toUpperCase())
        );
        // Si aucune prestation attribuée, on bloque la page
        if (!allowedCodes.size) {
          this.hasBpu.set(false);
          this.bpuItems.set([]);
          this.bpuPrices.set(new Map());
          this.bpuLoading.set(false);
          return [];
        }
        // Construire la price map depuis la sélection active
        const priceMap = new Map<string, number>();
        for (const p of active?.prestations || []) {
          const code = String(p.code || '').toUpperCase();
          if (code) priceMap.set(code, Number(p.unitPrice ?? 0));
        }
        this.bpuPrices.set(priceMap);
        this.hasBpu.set(true);
        // Charger le catalogue BPU pour récupérer les libellés
        return this.bpuService.list().pipe(
          switchMap((allItems: BpuEntry[]) => {
            const seen = new Set<string>();
            const bpuItems: BpuItem[] = [];
            for (const item of allItems) {
              const code = String(item.code || '').toUpperCase();
              if (!allowedCodes.has(code) || seen.has(code)) continue;
              seen.add(code);
              bpuItems.push({ code, prestation: item.prestation || item.code || '' });
            }
            this.bpuItems.set(bpuItems);
            this.bpuLoading.set(false);
            return [];
          })
        );
      })
    ).subscribe({
      error: (err) => {
        this.bpuError.set(this.apiError(err, 'Erreur chargement BPU'));
        this.bpuLoading.set(false);
      }
    });
  }

  // ── Stepper quantités ──────────────────────────────────────────────────────

  qtyFor(code: string): number {
    return this.qtys().get(code) ?? 0;
  }

  stepCode(code: string, delta: number): void {
    const next = new Map(this.qtys());
    next.set(code, Math.max(0, (next.get(code) ?? 0) + delta));
    this.qtys.set(next);
  }

  setQty(code: string, event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    const next = new Map(this.qtys());
    next.set(code, Math.max(0, Math.round(Number.isFinite(val) ? val : 0)));
    this.qtys.set(next);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { date, comment } = this.form.getRawValue();
    const prestations = Array.from(this.qtys().entries())
      .filter(([, qty]) => qty > 0)
      .map(([code, qty]) => ({ code, qty }));

    this.loading.set(true);
    this.error.set(null);
    const current = this.editing();
    const request$ = current?._id
      ? this.reportService.update(current._id, { prestations, comment })
      : this.reportService.create({ date, prestations, comment });

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
    this.form.patchValue({ date, comment: report.comment || '' });

    // Restaurer les quantités depuis le rapport
    const next = new Map<string, number>();
    for (const { code, qty } of report.prestations || []) {
      next.set(String(code).toUpperCase(), qty);
    }
    this.qtys.set(next);
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

  // ── Helpers liste ──────────────────────────────────────────────────────────

  isToday(report: TechnicianReport): boolean {
    return (this.datePipe.transform(report.reportDate, 'yyyy-MM-dd') || '') === this.todayInput();
  }

  prestationsSummary(report: TechnicianReport): Array<{ code: string; label: string; qty: number }> {
    const prestations = Array.isArray(report.prestations) ? report.prestations : [];
    return prestations
      .filter((p) => p.qty > 0)
      .map((p) => ({
        code: p.code,
        label: this.bpuItems().find((b) => b.code === p.code)?.prestation || p.code,
        qty: p.qty
      }));
  }

  private static readonly CODE_ALIASES: Record<string, string> = {
    'RACPAV': 'RAC_PBO_SOUT'
  };

  computeAmount(report: TechnicianReport): number {
    const prestations = Array.isArray(report.prestations) ? report.prestations : [];
    if (!prestations.length) return Number(report.amount ?? 0);
    const prices = this.bpuPrices();
    let total = 0;
    for (const { code, qty } of prestations) {
      if (!qty) continue;
      const key = String(code || '').toUpperCase();
      let price = prices.get(key);
      if (!Number.isFinite(price)) {
        const aliasKey = TechnicianReports.CODE_ALIASES[key];
        if (aliasKey) price = prices.get(aliasKey);
      }
      if (Number.isFinite(price)) total += qty * (price as number);
    }
    return Number(total.toFixed(2));
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  refresh(force = false): void {
    if (!force && this.loading()) return;
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

  applyFilters(): void { this.page.set(1); this.refresh(true); }
  clearFilters(): void {
    this.filterForm.reset({ year: '', fromDate: '', toDate: '' });
    this.page.set(1);
    this.refresh(true);
  }
  toggleFilters(): void { this.filtersOpen.update((v) => !v); }
  prevPage(): void { if (this.canPrev()) { this.page.update((p) => p - 1); this.refresh(true); } }
  nextPage(): void { if (this.canNext()) { this.page.update((p) => p + 1); this.refresh(true); } }

  setLimit(event: Event): void {
    const val = Number((event.target as HTMLSelectElement).value);
    this.setLimitValue(val);
  }
  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh(true);
  }

  formatAmount(value?: number | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
  }

  // ── Privés ─────────────────────────────────────────────────────────────────

  private todayInput(): string {
    return this.datePipe.transform(new Date(), 'yyyy-MM-dd') || '';
  }

  private resetForm(): void {
    this.form.reset({ date: this.todayInput(), comment: '' });
    this.qtys.set(new Map());
    this.form.markAsPristine();
  }

  private normalizeDateRange(yearInput: string, fromInput: string, toInput: string): { fromDate: string; toDate: string } {
    const year = Number(yearInput);
    if (Number.isFinite(year) && year >= 2000) {
      return { fromDate: fromInput || `${year}-01-01`, toDate: toInput || `${year}-12-31` };
    }
    return { fromDate: fromInput || '', toDate: toInput || '' };
  }

  private apiError(err: any, fallback: string): string {
    const apiMsg = typeof err?.error === 'object' && err.error !== null && 'message' in err.error
      ? String(err.error.message ?? '')
      : '';
    return apiMsg || err?.message || fallback;
  }
}
