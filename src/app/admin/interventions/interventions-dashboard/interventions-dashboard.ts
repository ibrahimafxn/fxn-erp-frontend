import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  InterventionService,
  InterventionSummaryItem,
  InterventionFilters,
  InterventionTotals,
  InterventionItem,
  InterventionInvoiceSummary,
  InterventionCompare
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
  private readonly RATES_VIS_KEY = 'fxn.interventions.showRates';
  private svc = inject(InterventionService);
  private fb = inject(FormBuilder);
  private ratesService = inject(InterventionRatesService);
  private auth = inject(AuthService);

  @ViewChild('csvInput') private csvInput?: ElementRef<HTMLInputElement>;
  @ViewChild('invoiceInput') private invoiceInput?: ElementRef<HTMLInputElement>;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly importLoading = signal(false);
  readonly importResult = signal<string | null>(null);
  readonly importError = signal<string | null>(null);
  readonly resetLoading = signal(false);
  readonly resetResult = signal<string | null>(null);
  readonly resetError = signal<string | null>(null);
  readonly resetModalOpen = signal(false);
  readonly rateSaving = signal(false);
  readonly rateSuccess = signal<string | null>(null);
  readonly rateError = signal<string | null>(null);
  readonly showRates = signal(true);
  readonly invoiceLoading = signal(false);
  readonly invoiceResult = signal<string | null>(null);
  readonly invoiceError = signal<string | null>(null);
  readonly compareLoading = signal(false);
  readonly compareError = signal<string | null>(null);
  readonly invoiceSummary = signal<InterventionInvoiceSummary | null>(null);
  readonly compareResult = signal<InterventionCompare | null>(null);
  readonly selectedPeriodKey = signal<string>('');

  readonly summaryItems = signal<InterventionSummaryItem[]>([]);
  readonly totals = signal<InterventionTotals | null>(null);
  readonly totalItems = signal(0);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly detailItems = signal<InterventionItem[]>([]);
  readonly detailTotal = signal(0);
  readonly detailPage = signal(1);
  readonly detailLimit = signal(20);
  readonly detailTechnician = signal<string | null>(null);
  readonly detailGroups = computed(() => {
    const items = this.detailItems();
    const order = [
      { key: 'racPavillon', label: 'Raccordement pavillon' },
      { key: 'racImmeuble', label: 'Raccordement immeuble' },
      { key: 'reconnexion', label: 'Reconnexion' },
      { key: 'sav', label: 'SAV' },
      { key: 'b2b', label: 'Raccordement B2B' },
      { key: 'other', label: 'Autres' }
    ];
    const buckets = new Map(order.map((group) => [group.key, [] as InterventionItem[]]));

    for (const item of items) {
      const categories = Array.isArray(item.categories) ? item.categories : [];
      const type = this.normalizeText(item.type);
      const status = this.normalizeText(item.statut);
      const isClosed = status.includes('CLOTURE') && status.includes('TERMINEE');
      const isReconnexion = type.includes('RECO') || this.hasReconnexionInArticles(item.articlesRaw);
      const isB2b = categories.includes('racProS')
        || categories.includes('racProC')
        || this.hasB2bInArticles(item.articlesRaw);
      let key = 'other';
      if (isClosed && isReconnexion) key = 'reconnexion';
      else if (categories.includes('racPavillon')) key = 'racPavillon';
      else if (categories.includes('racImmeuble')) key = 'racImmeuble';
      else if (categories.includes('reconnexion')) key = 'reconnexion';
      else if (categories.includes('sav')) key = 'sav';
      else if (isB2b) key = 'b2b';
      else {
        if (type.includes('PRESTA') && type.includes('COMPL')) key = 'other';
        else if (type.includes('SAV')) key = 'sav';
        else if (isReconnexion) key = 'reconnexion';
      }
      (buckets.get(key) || buckets.get('other'))?.push(item);
    }

    return order
      .map((group) => ({ ...group, items: buckets.get(group.key) || [] }))
      .filter((group) => group.items.length > 0);
  });

  private normalizeText(value?: string | null): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private hasReconnexionInArticles(raw?: string | null): boolean {
    const normalized = this.normalizeText(raw);
    if (!normalized) return false;
    return normalized.includes('RECOIP') || normalized.includes('RECO');
  }

  private hasB2bInArticles(raw?: string | null): boolean {
    const normalized = this.normalizeText(raw);
    if (!normalized) return false;
    return normalized.includes('RACPRO') || normalized.includes('RAC PRO');
  }

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

  readonly detailPageCount = computed(() => {
    const t = this.detailTotal();
    const l = this.detailLimit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  private touchStartX = 0;
  private touchStartY = 0;
  private touchTargetTech: string | null = null;

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
    racPavillon: this.fb.nonNullable.group({
      total: [140, [Validators.required, Validators.min(0)]],
      fxn: [10, [Validators.required, Validators.min(0)]]
    }),
    clem: this.fb.nonNullable.group({
      total: [5, [Validators.required, Validators.min(0)]],
      fxn: [5, [Validators.required, Validators.min(0)]]
    }),
    reconnexion: this.fb.nonNullable.group({
      total: [45, [Validators.required, Validators.min(0)]],
      fxn: [15, [Validators.required, Validators.min(0)]]
    }),
    racImmeuble: this.fb.nonNullable.group({
      total: [80, [Validators.required, Validators.min(0)]],
      fxn: [20, [Validators.required, Validators.min(0)]]
    }),
    racProS: this.fb.nonNullable.group({
      total: [195, [Validators.required, Validators.min(0)]],
      fxn: [45, [Validators.required, Validators.min(0)]]
    }),
    racProC: this.fb.nonNullable.group({
      total: [245, [Validators.required, Validators.min(0)]],
      fxn: [55, [Validators.required, Validators.min(0)]]
    }),
    racF8: this.fb.nonNullable.group({
      total: [200, [Validators.required, Validators.min(0)]],
      fxn: [100, [Validators.required, Validators.min(0)]]
    }),
    deprise: this.fb.nonNullable.group({
      total: [50, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    demo: this.fb.nonNullable.group({
      total: [10, [Validators.required, Validators.min(0)]],
      fxn: [10, [Validators.required, Validators.min(0)]]
    }),
    sav: this.fb.nonNullable.group({
      total: [10, [Validators.required, Validators.min(0)]],
      fxn: [10, [Validators.required, Validators.min(0)]]
    }),
    refrac: this.fb.nonNullable.group({
      total: [0, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    refcDgr: this.fb.nonNullable.group({
      total: [50, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    })
  });

  toggleRates(): void {
    this.showRates.update((value) => {
      const next = !value;
      localStorage.setItem(this.RATES_VIS_KEY, String(next));
      return next;
    });
  }

  private readonly rateSync = effect(() => {
    const rates = this.ratesService.rates();
    this.rateForm.patchValue(rates, { emitEvent: false });
  });

  selectedFile: File | null = null;
  selectedInvoices: File[] = [];
  readonly rates = this.ratesService.rates;
  readonly periodOptions = computed(() => {
    const invoices = this.invoiceSummary()?.invoices || [];
    const map = new Map<string, string>();
    for (const invoice of invoices) {
      if (!invoice.periodKey) continue;
      if (!map.has(invoice.periodKey)) {
        map.set(invoice.periodKey, invoice.periodLabel || invoice.periodKey);
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  });
  readonly compareTotals = computed(() => {
    const compare = this.compareResult();
    if (!compare) return null;
    return {
      osiris: compare.osiris.totalAmount || 0,
      invoice: compare.invoice.totalAmount || 0,
      delta: (compare.osiris.totalAmount || 0) - (compare.invoice.totalAmount || 0)
    };
  });

  constructor() {
    const stored = localStorage.getItem(this.RATES_VIS_KEY);
    if (stored != null) {
      this.showRates.set(stored !== 'false');
    }
    this.loadFilters();
    this.loadInvoices();
    this.ratesService.refresh().subscribe();
    this.refresh();
  }

  openDetail(technician: string): void {
    if (!technician) return;
    this.detailTechnician.set(technician);
    this.detailPage.set(1);
    this.detailOpen.set(true);
    this.loadDetail();
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailItems.set([]);
    this.detailError.set(null);
  }

  onRowTouchStart(event: TouchEvent, technician: string): void {
    if (!technician || event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchTargetTech = technician;
  }

  onRowTouchEnd(event: TouchEvent): void {
    if (!this.touchTargetTech || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 40 && deltaX < 0) {
      this.openDetail(this.touchTargetTech);
    }
    this.touchTargetTech = null;
  }

  onDetailTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  onDetailTouchEnd(event: TouchEvent): void {
    if (event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 40 && deltaX > 0) {
      this.closeDetail();
    }
  }

  detailPrev(): void {
    if (this.detailPage() <= 1) return;
    this.detailPage.set(this.detailPage() - 1);
    this.loadDetail();
  }

  detailNext(): void {
    if (this.detailPage() >= this.detailPageCount()) return;
    this.detailPage.set(this.detailPage() + 1);
    this.loadDetail();
  }

  detailLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.detailLimit.set(v);
    this.detailPage.set(1);
    this.loadDetail();
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

  onFileClick(): void {
    const input = this.csvInput?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.selectedFile = null;
    this.importError.set(null);
    this.importResult.set(null);
  }

  onInvoiceClick(): void {
    const input = this.invoiceInput?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.selectedInvoices = [];
    this.invoiceError.set(null);
    this.invoiceResult.set(null);
  }

  onInvoiceChange(event: Event): void {
    const el = event.target instanceof HTMLInputElement ? event.target : null;
    this.selectedInvoices = el?.files ? Array.from(el.files) : [];
    this.invoiceError.set(null);
    this.invoiceResult.set(null);
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

  importInvoices(): void {
    if (!this.selectedInvoices.length) {
      this.invoiceError.set('Sélectionne au moins un PDF.');
      return;
    }
    this.invoiceLoading.set(true);
    this.invoiceError.set(null);
    this.invoiceResult.set(null);
    this.svc.importInvoices(this.selectedInvoices).subscribe({
      next: (res) => {
        this.invoiceLoading.set(false);
        if (res.success) {
          const data = res.data as { imported?: number; skipped?: number } | undefined;
          const imported = data?.imported ?? 0;
          const skipped = data?.skipped ?? 0;
          this.invoiceResult.set(`Factures importées : ${imported}. Ignorées : ${skipped}.`);
          this.resetInvoiceInput();
          this.loadInvoices();
          this.refreshCompare();
          return;
        }
        this.invoiceError.set(res.message || 'Erreur import factures');
        this.resetInvoiceInput();
      },
      error: (err: HttpErrorResponse) => {
        this.invoiceLoading.set(false);
        this.invoiceError.set(this.apiError(err, 'Erreur import factures'));
        this.resetInvoiceInput();
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
        const items = (res.data.items || [])
          .map((item) => this.normalizeSummaryItem(item))
          .filter((item): item is InterventionSummaryItem => item !== null);
        const totals = this.normalizeSummaryItem(res.data.totals || null);
        this.summaryItems.set(items);
        this.totals.set(totals);
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

  private loadInvoices(): void {
    this.svc.invoiceSummary().subscribe({
      next: (res) => {
        this.invoiceSummary.set(res.data);
        const options = this.periodOptions();
        if (!this.selectedPeriodKey() && options.length) {
          this.selectedPeriodKey.set(options[0].key);
        }
        this.refreshCompare();
      },
      error: () => {}
    });
  }

  refreshCompare(): void {
    const f = this.filterForm.getRawValue();
    this.compareLoading.set(true);
    this.compareError.set(null);
    this.svc.compare({
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      technician: f.technician || undefined,
      region: f.region || undefined,
      client: f.client || undefined,
      status: f.status || undefined,
      type: f.type || undefined,
      periodKey: this.selectedPeriodKey() || undefined
    }).subscribe({
      next: (res) => {
        this.compareResult.set(res.data);
        this.compareLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.compareLoading.set(false);
        this.compareError.set(this.apiError(err, 'Erreur comparaison factures'));
      }
    });
  }

  onPeriodChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    this.selectedPeriodKey.set(el.value);
    this.refreshCompare();
  }

  private loadDetail(): void {
    const tech = this.detailTechnician();
    if (!tech) return;
    const f = this.filterForm.getRawValue();
    this.detailLoading.set(true);
    this.detailError.set(null);

    this.svc.list({
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      technician: tech,
      region: f.region || undefined,
      client: f.client || undefined,
      status: f.status || undefined,
      type: f.type || undefined,
      page: this.detailPage(),
      limit: this.detailLimit()
    }).subscribe({
      next: (res) => {
        this.detailItems.set(res.data.items || []);
        this.detailTotal.set(res.data.total ?? 0);
        if (res.data.page) this.detailPage.set(res.data.page);
        if (res.data.limit) this.detailLimit.set(res.data.limit);
        this.detailLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.detailLoading.set(false);
        this.detailError.set(this.apiError(err, 'Erreur chargement interventions'));
      }
    });
  }

  private normalizeSummaryItem<T extends InterventionSummaryItem | InterventionTotals>(item: T | null): T | null {
    if (!item) return null;
    const raw = item as Record<string, unknown>;
    if (item.racProS == null && typeof raw['racpro_s'] === 'number') {
      (item as { racProS?: number }).racProS = raw['racpro_s'] as number;
    }
    if (item.racProC == null && typeof raw['racpro_c'] === 'number') {
      (item as { racProC?: number }).racProC = raw['racpro_c'] as number;
    }
    if (item.refcDgr == null && typeof raw['refc_dgr'] === 'number') {
      (item as { refcDgr?: number }).refcDgr = raw['refc_dgr'] as number;
    }
    return item;
  }

  search(): void {
    this.page.set(1);
    this.refresh();
    this.refreshCompare();
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
    this.refreshCompare();
  }

  saveRates(): void {
    const raw = this.rateForm.getRawValue() as InterventionRates;
    if (!this.rateForm.valid) {
      this.rateForm.markAllAsTouched();
      return;
    }
    if (this.findInvalidRates().length) {
      return;
    }
    this.rateSaving.set(true);
    this.rateSuccess.set(null);
    this.rateError.set(null);
    this.ratesService.save(raw).subscribe({
      next: () => {
        this.rateSaving.set(false);
        this.rateSuccess.set('Tarifs enregistrés.');
        this.rateForm.markAsPristine();
      },
      error: (err: HttpErrorResponse) => {
        this.rateSaving.set(false);
        this.rateError.set(this.apiError(err, 'Erreur enregistrement tarifs'));
      }
    });
  }

  resetRates(): void {
    this.rateSuccess.set(null);
    this.rateError.set(null);
    const rates = this.ratesService.rates();
    this.rateForm.patchValue(rates, { emitEvent: false });
    this.rateForm.markAsPristine();
    this.rateSuccess.set('Tarifs réinitialisés.');
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

  resetInvoiceInput(): void {
    this.selectedInvoices = [];
    const input = this.invoiceInput?.nativeElement;
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
    const share = (entry: { total: number; fxn: number }) => {
      const fxn = entry.fxn || 0;
      const total = entry.total || 0;
      const tech = Math.max(0, total - fxn);
      return target === 'fxn' ? fxn : tech;
    };

    return (
      get(item.racPavillon) * share(rates.racPavillon) +
      get(item.clem) * share(rates.clem) +
      get(item.reconnexion) * share(rates.reconnexion) +
      get(item.racImmeuble) * share(rates.racImmeuble) +
      get(item.racProS) * share(rates.racProS) +
      get(item.racProC) * share(rates.racProC) +
      get(item.racF8) * share(rates.racF8) +
      get(item.deprise) * share(rates.deprise) +
      get(item.demo) * share(rates.demo) +
      get(item.sav) * share(rates.sav) +
      get(item.refrac) * share(rates.refrac) +
      get(item.refcDgr) * share(rates.refcDgr)
    );
  }

  techShareFor(key: string): number {
    const entry = (this.rateForm.getRawValue() as Record<string, { total: number; fxn: number }>)[key];
    const total = Number(entry?.total ?? 0);
    const fxn = Number(entry?.fxn ?? 0);
    return Math.max(0, total - fxn);
  }

  formatArticleCodes(raw?: string | null): string {
    if (!raw) return '—';
    const excluded = new Set(['CABLE_PAV_1', 'CABLE_PAV_2', 'CABLE_PAV_3', 'CABLE_PAV_4']);
    const parts = String(raw)
      .split(/[,;+]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/"/g, '').trim())
      .map((part) => part.replace(/\s+x?\d+$/i, '').trim())
      .filter(Boolean)
      .map((part) => part.toUpperCase())
      .filter((part) => !excluded.has(part));
    return parts.length ? parts.join(', ') : '—';
  }

  isRateInvalid(key: string): boolean {
    const entry = (this.rateForm.getRawValue() as Record<string, { total: number; fxn: number }>)[key];
    if (!entry) return false;
    const total = Number(entry.total);
    const fxn = Number(entry.fxn);
    return Number.isFinite(total) && Number.isFinite(fxn) && fxn > total;
  }

  private findInvalidRates(): string[] {
    return this.rateFields
      .map((field) => field.key)
      .filter((key) => this.isRateInvalid(String(key)));
  }
}
