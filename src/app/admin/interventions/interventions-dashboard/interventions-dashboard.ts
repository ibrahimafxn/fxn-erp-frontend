import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  InterventionService,
  InterventionSummaryItem,
  InterventionFilters,
  InterventionTotals
} from '../../../core/services/intervention.service';
import { InterventionRatesService, InterventionRates } from '../../../core/services/intervention-rates.service';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/models/roles.model';

@Component({
  standalone: true,
  selector: 'app-interventions-dashboard',
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './interventions-dashboard.html',
  styleUrls: ['./interventions-dashboard.scss']
})
export class InterventionsDashboard {
  private svc = inject(InterventionService);
  private fb = inject(FormBuilder);
  private ratesService = inject(InterventionRatesService);
  private auth = inject(AuthService);

  @ViewChild('csvInput') private csvInput?: ElementRef<HTMLInputElement>;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly importLoading = signal(false);
  readonly importResult = signal<string | null>(null);
  readonly importError = signal<string | null>(null);
  readonly resetLoading = signal(false);
  readonly resetResult = signal<string | null>(null);
  readonly resetError = signal<string | null>(null);
  readonly resetModalOpen = signal(false);

  readonly summaryItems = signal<InterventionSummaryItem[]>([]);
  readonly totals = signal<InterventionTotals | null>(null);
  readonly totalItems = signal(0);
  readonly page = signal(1);
  readonly limit = signal(25);

  readonly filters = signal<InterventionFilters>({
    regions: [],
    clients: [],
    statuses: [],
    technicians: [],
    types: []
  });

  readonly filterForm = this.fb.nonNullable.group({
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control(''),
    technician: this.fb.nonNullable.control(''),
    region: this.fb.nonNullable.control(''),
    client: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control('CLOTURE TERMINEE'),
    type: this.fb.nonNullable.control('')
  });

  readonly hasData = computed(() => this.summaryItems().length > 0);
  readonly canEditRates = computed(() => this.auth.hasRole([Role.ADMIN, Role.DIRIGEANT]));
  readonly pageCount = computed(() => {
    const t = this.totalItems();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly rateFields = [
    { key: 'racPavillon', label: 'Raccordement pavillon', code: 'RACPAV' },
    { key: 'clem', label: 'Mise en service', code: 'CLEM' },
    { key: 'reconnexion', label: 'Reconnexion', code: 'RECOIP' },
    { key: 'racImmeuble', label: 'Raccordement immeuble', code: 'RACIH' },
    { key: 'racProS', label: 'Raccordement pro simple', code: 'RACPRO_S' },
    { key: 'racProC', label: 'Raccordement pro complexe', code: 'RACPRO_C' },
    { key: 'racF8', label: 'Raccordement F8', code: 'REPFOU_PRI' },
    { key: 'deprise', label: 'Déplacement prise', code: 'DEPLPRISE' },
    { key: 'demo', label: 'Démonstration service', code: 'DEMO' },
    { key: 'sav', label: 'Service après-vente', code: 'SAV' },
    { key: 'refrac', label: 'Raccord refait', code: 'REFRAC' },
    { key: 'refcDgr', label: 'Dégradation client', code: 'REFC_DGR' }
  ] as const;

  readonly rateForm = this.fb.nonNullable.group({
    racPavillon: this.fb.nonNullable.group({ fxn: 10, tech: 130 }),
    clem: this.fb.nonNullable.group({ fxn: 5, tech: 0 }),
    reconnexion: this.fb.nonNullable.group({ fxn: 15, tech: 30 }),
    racImmeuble: this.fb.nonNullable.group({ fxn: 20, tech: 60 }),
    racProS: this.fb.nonNullable.group({ fxn: 45, tech: 150 }),
    racProC: this.fb.nonNullable.group({ fxn: 55, tech: 190 }),
    racF8: this.fb.nonNullable.group({ fxn: 100, tech: 100 }),
    deprise: this.fb.nonNullable.group({ fxn: 0, tech: 50 }),
    demo: this.fb.nonNullable.group({ fxn: 10, tech: 0 }),
    sav: this.fb.nonNullable.group({ fxn: 10, tech: 0 }),
    refrac: this.fb.nonNullable.group({ fxn: 0, tech: 0 }),
    refcDgr: this.fb.nonNullable.group({ fxn: 0, tech: 50 })
  });

  private readonly rateSync = effect(() => {
    const rates = this.ratesService.rates();
    this.rateForm.patchValue(rates, { emitEvent: false });
  });

  selectedFile: File | null = null;
  readonly rates = this.ratesService.rates;

  constructor() {
    this.loadFilters();
    this.refresh();
  }

  onFileChange(event: Event): void {
    const el = event.target instanceof HTMLInputElement ? event.target : null;
    if (!el?.files?.length) {
      this.selectedFile = null;
      return;
    }
    this.selectedFile = el.files[0];
    this.importError.set(null);
    this.importResult.set(null);
  }

  importCsv(): void {
    if (!this.selectedFile) {
      this.importError.set('Sélectionne un fichier CSV.');
      return;
    }

    this.importLoading.set(true);
    this.importError.set(null);
    this.importResult.set(null);

    this.svc.importCsv(this.selectedFile).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        if (res.success) {
          this.importResult.set('Import terminé.');
          this.resetFileInput();
          this.loadFilters();
          this.refresh();
          return;
        }
        this.importError.set(res.message || 'Erreur import CSV');
        this.resetFileInput();
      },
      error: (err: HttpErrorResponse) => {
        this.importLoading.set(false);
        this.importError.set(this.apiError(err, 'Erreur import CSV'));
        this.resetFileInput();
      }
    });
  }

  openResetModal(): void {
    this.resetModalOpen.set(true);
  }

  closeResetModal(): void {
    this.resetModalOpen.set(false);
  }

  confirmResetData(): void {
    this.resetModalOpen.set(false);
    this.resetLoading.set(true);
    this.resetError.set(null);
    this.resetResult.set(null);

    this.svc.resetAll().subscribe({
      next: (res) => {
        this.resetLoading.set(false);
        if (res.success) {
          const deleted = res.data?.deleted ?? 0;
          this.resetResult.set(`Données supprimées (${deleted}).`);
          this.summaryItems.set([]);
          this.totals.set(null);
          this.loadFilters();
          this.refresh();
          return;
        }
        this.resetError.set('Erreur suppression');
      },
      error: (err: HttpErrorResponse) => {
        this.resetLoading.set(false);
        this.resetError.set(this.apiError(err, 'Erreur suppression'));
      }
    });
  }

  refresh(): void {
    const f = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.svc.summary({
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      technician: f.technician || undefined,
      region: f.region || undefined,
      client: f.client || undefined,
      status: f.status || undefined,
      type: f.type || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        this.summaryItems.set(res.data.items || []);
        this.totals.set(res.data.totals || null);
        this.totalItems.set(res.data.total ?? res.data.items?.length ?? 0);
        if (res.data.page) this.page.set(res.data.page);
        if (res.data.limit) this.limit.set(res.data.limit);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement indicateurs'));
      }
    });
  }

  search(): void {
    this.page.set(1);
    this.refresh();
  }

  clearFilters(): void {
    this.filterForm.reset({
      fromDate: '',
      toDate: '',
      technician: '',
      region: '',
      client: '',
      status: 'CLOTURE TERMINEE',
      type: ''
    });
    this.page.set(1);
    this.refresh();
  }

  saveRates(): void {
    const raw = this.rateForm.getRawValue() as InterventionRates;
    this.ratesService.save(raw);
  }

  resetRates(): void {
    this.ratesService.reset();
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.refresh();
  }

  nextPage(): void {
    if (this.page() >= this.pageCount()) return;
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

  racTotal(item: InterventionSummaryItem | InterventionTotals | null): number {
    if (!item) return 0;
    return (item.racPavillon || 0)
      + (item.racImmeuble || 0)
      + (item.racF8 || 0)
      + (item.racProS || 0)
      + (item.racProC || 0)
      + (item.deprise || 0)
      + (item.demo || 0)
      + (item.refrac || 0)
      + (item.refcDgr || 0)
      + (item.racAutre || 0);
  }

  fxnRevenue(item: InterventionSummaryItem | InterventionTotals | null): number {
    if (!item) return 0;
    const rates = this.rates();
    return this.sumRevenue(item, rates, 'fxn');
  }

  techRevenue(item: InterventionSummaryItem | InterventionTotals | null): number {
    if (!item) return 0;
    const rates = this.rates();
    return this.sumRevenue(item, rates, 'tech');
  }

  totalRevenue = computed(() => {
    const totals = this.totals();
    if (totals) {
      return {
        fxn: this.fxnRevenue(totals),
        tech: this.techRevenue(totals)
      };
    }
    const items = this.summaryItems();
    const acc = { fxn: 0, tech: 0 };
    for (const it of items) {
      acc.fxn += this.fxnRevenue(it);
      acc.tech += this.techRevenue(it);
    }
    return acc;
  });

  private loadFilters(): void {
    this.svc.filters().subscribe({
      next: (res) => {
        this.filters.set(res.data);
      },
      error: () => {}
    });
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }

  resetFileInput(): void {
    this.selectedFile = null;
    const input = this.csvInput?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  private sumRevenue(
    item: InterventionSummaryItem | InterventionTotals,
    rates: InterventionRates,
    target: 'fxn' | 'tech'
  ): number {
    const get = (value?: number) => value ?? 0;
    return (
      get(item.racPavillon) * rates.racPavillon[target] +
      get(item.clem) * rates.clem[target] +
      get(item.reconnexion) * rates.reconnexion[target] +
      get(item.racImmeuble) * rates.racImmeuble[target] +
      get(item.racProS) * rates.racProS[target] +
      get(item.racProC) * rates.racProC[target] +
      get(item.racF8) * rates.racF8[target] +
      get(item.deprise) * rates.deprise[target] +
      get(item.demo) * rates.demo[target] +
      get(item.sav) * rates.sav[target] +
      get(item.refrac) * rates.refrac[target] +
      get(item.refcDgr) * rates.refcDgr[target]
    );
  }
}
