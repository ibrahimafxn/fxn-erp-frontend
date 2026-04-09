import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { TechnicianReportService, TechnicianReport } from '../../../core/services/technician-report.service';
import { BpuService } from '../../../core/services/bpu.service';
import { BpuSelectionService } from '../../../core/services/bpu-selection.service';
import { AuthService } from '../../../core/services/auth.service';
import { EffectiveBpuService } from '../../../core/services/effective-bpu.service';
import { BpuEntry, BpuSelection, EffectiveBpuItem } from '../../../core/models';
import { formatPageRange } from '../../../core/utils/pagination';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';

type BpuItem = {
  prestationId?: string;
  code: string;
  prestation: string;
  unitPrice: number;
};

type ResolvedBpuState = {
  items: BpuItem[];
  prices: Map<string, number>;
};

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
  private effectiveBpuService = inject(EffectiveBpuService);
  private auth = inject(AuthService);
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
  readonly selectedCount = computed(() =>
    Array.from(this.qtys().values()).reduce((sum, qty) => sum + (qty > 0 ? qty : 0), 0)
  );
  readonly formTotalAmount = computed(() =>
    this.bpuItems().reduce((sum, item) => sum + this.lineAmount(item.code), 0)
  );

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
    this.resolveBpuState$().subscribe({
      next: (state) => {
        this.applyBpuState(state);
        this.bpuLoading.set(false);
      },
      error: (err) => {
        this.hasBpu.set(false);
        this.bpuItems.set([]);
        this.bpuPrices.set(new Map());
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
    const entries = this.bpuItems()
      .map((item) => ({
        prestationId: item.prestationId,
        quantite: this.qtyFor(item.code)
      }))
      .filter((item) => !!item.prestationId && item.quantite > 0)
      .map((item) => ({ prestationId: item.prestationId as string, quantite: item.quantite }));

    this.loading.set(true);
    this.error.set(null);
    const current = this.editing();
    const request$ = current?._id
      ? this.reportService.update(current._id, { prestations, entries, comment, commentaire: comment })
      : this.reportService.create({
          date,
          dateActivite: date,
          prestations,
          entries,
          comment,
          commentaire: comment
        });

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
    const entries = Array.isArray(report.entries) ? report.entries : [];
    if (entries.length) {
      for (const entry of entries) {
        const code = String(entry.codeSnapshot || entry.code || '').toUpperCase();
        const qty = Number(entry.quantite ?? entry.qty ?? 0);
        if (code && qty > 0) next.set(code, qty);
      }
    } else {
      for (const { code, qty } of report.prestations || []) {
        next.set(String(code).toUpperCase(), qty);
      }
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
    const entries = Array.isArray(report.entries) ? report.entries : [];
    if (entries.length) {
      return entries
        .filter((entry) => Number(entry.quantite ?? entry.qty ?? 0) > 0)
        .map((entry) => ({
          code: String(entry.codeSnapshot || entry.code || '').toUpperCase(),
          label: entry.libelleSnapshot || String(entry.codeSnapshot || entry.code || ''),
          qty: Number(entry.quantite ?? entry.qty ?? 0)
        }));
    }
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
    if (Number.isFinite(report.totalCa)) return Number(report.totalCa);
    const entries = Array.isArray(report.entries) ? report.entries : [];
    if (entries.length) {
      const total = entries.reduce((sum, entry) => {
        if (Number.isFinite(entry.totalCaLigne)) return sum + Number(entry.totalCaLigne);
        if (Number.isFinite(entry.montantLigne)) return sum + Number(entry.montantLigne);
        const qty = Number(entry.quantite ?? entry.qty ?? 0);
        const price = Number(entry.prixUnitaireSnapshot ?? 0);
        return sum + (qty > 0 && Number.isFinite(price) ? qty * price : 0);
      }, 0);
      if (total > 0) return Number(total.toFixed(2));
    }
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
    return total > 0 ? Number(total.toFixed(2)) : Number(report.amount ?? 0);
  }

  unitPriceFor(code: string): number {
    const key = String(code || '').toUpperCase();
    let price = this.bpuPrices().get(key);
    if (!Number.isFinite(price)) {
      const aliasKey = TechnicianReports.CODE_ALIASES[key];
      if (aliasKey) price = this.bpuPrices().get(aliasKey);
    }
    return Number.isFinite(price) ? Number(price) : 0;
  }

  lineAmount(code: string): number {
    return Number((this.qtyFor(code) * this.unitPriceFor(code)).toFixed(2));
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

  private resolveBpuState$(): Observable<ResolvedBpuState> {
    const technicianId = this.currentUserId();
    if (!technicianId) return this.resolveLegacyBpuState$();

    return this.effectiveBpuService.getTechnicianEffectiveBpu(technicianId).pipe(
      map((items) => {
        const normalized = [...(items || [])]
          .filter((item) => !!String(item.code || '').trim())
          .sort((a, b) => Number(a.ordreAffichage ?? 0) - Number(b.ordreAffichage ?? 0));
        if (!normalized.length) {
          throw new Error('EMPTY_EFFECTIVE_BPU');
        }
        const prices = new Map<string, number>();
        const resolvedItems: BpuItem[] = normalized.map((item: EffectiveBpuItem) => {
          const code = String(item.code || '').trim().toUpperCase();
          const unitPrice = Number(item.prixUnitaire ?? 0);
          prices.set(code, unitPrice);
          return {
            prestationId: item.prestationId,
            code,
            prestation: item.libelle || code,
            unitPrice
          };
        });
        return { items: resolvedItems, prices };
      }),
      catchError(() => this.resolveLegacyBpuState$())
    );
  }

  private resolveLegacyBpuState$(): Observable<ResolvedBpuState> {
    return this.bpuSelectionService.list().pipe(
      switchMap((selections: BpuSelection[]) => {
        const sorted = [...selections].sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        const active = sorted[0] ?? null;
        const allowedCodes = new Set(
          (active?.prestations || []).map((p) => String(p.code || '').toUpperCase())
        );
        if (!allowedCodes.size) {
          return of({ items: [], prices: new Map<string, number>() });
        }
        const prices = new Map<string, number>();
        for (const p of active?.prestations || []) {
          const code = String(p.code || '').toUpperCase();
          if (code) prices.set(code, Number(p.unitPrice ?? 0));
        }
        return this.bpuService.list().pipe(
          map((allItems: BpuEntry[]) => {
            const seen = new Set<string>();
            const items: BpuItem[] = [];
            for (const item of allItems) {
              const code = String(item.code || '').toUpperCase();
              if (!allowedCodes.has(code) || seen.has(code)) continue;
              seen.add(code);
              items.push({
                code,
                prestation: item.prestation || item.code || '',
                unitPrice: prices.get(code) ?? 0
              });
            }
            return { items, prices };
          })
        );
      })
    );
  }

  private applyBpuState(state: ResolvedBpuState): void {
    this.bpuItems.set(state.items);
    this.bpuPrices.set(state.prices);
    this.hasBpu.set(state.items.length > 0);
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

  private currentUserId(): string | null {
    const user = this.auth.getCurrentUser();
    return user?._id ? String(user._id) : null;
  }
}
