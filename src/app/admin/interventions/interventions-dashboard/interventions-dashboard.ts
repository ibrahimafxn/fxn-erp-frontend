import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, ElementRef, ViewChild, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  InterventionService,
  InterventionSummaryItem,
  InterventionSummaryQuery,
  InterventionFilters,
  InterventionTotals,
  InterventionItem,
  InterventionInvoiceSummary,
  InterventionCompare,
  InterventionImportBatch,
  InterventionImportTicket
} from '../../../core/services/intervention.service';
import { InterventionRatesService, InterventionRates } from '../../../core/services/intervention-rates.service';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/models/roles.model';
import { Depot, User } from '../../../core/models';
import { DepotService } from '../../../core/services/depot.service';
import { HrService } from '../../../core/services/hr.service';
import { EmployeeSummary } from '../../../core/models/hr.model';
import { formatPageRange } from '../../../core/utils/pagination';
import { formatPersonName } from '../../../core/utils/text-format';
import { INTERVENTION_PRESTATION_FIELDS } from '../../../core/constant/intervention-prestations';
import { downloadBlob } from '../../../core/utils/download';
import { preferredPageSize } from '../../../core/utils/page-size';
import {
  DETAIL_GROUP_ORDER,
  DETAIL_SUMMARY_PRESTATIONS,
  EMPTY_SUMMARY_FILTERS,
  extractCodesFromText,
  extractImportedArticleCodes,
  HIDDEN_PRESTATION_CODES,
  INTERVENTION_CONTRACT_TYPES,
  isSfrB2bMarque,
  hasReconnexionInArticles,
  normalizeInterventionText,
  QUICK_SUMMARY_PRESTATIONS,
  resolveBillingCodes,
  REVENUE_CODE_ALIASES,
  REVENUE_KEYS
} from './interventions-dashboard.constants';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-interventions-dashboard',
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal, RouterModule],
  templateUrl: './interventions-dashboard.html',
  styleUrls: ['./interventions-dashboard.scss']
})
export class InterventionsDashboard {
  private readonly emptySummaryFilters = EMPTY_SUMMARY_FILTERS;
  private readonly hiddenPrestationCodes = new Set<string>(HIDDEN_PRESTATION_CODES);

  private readonly RATES_VIS_KEY = 'fxn.interventions.showRates';
  private svc = inject(InterventionService);
  private fb = inject(FormBuilder);
  private ratesService = inject(InterventionRatesService);
  private auth = inject(AuthService);
  private depotService = inject(DepotService);
  private hrService = inject(HrService);

  @ViewChild('csvInput') private csvInput?: ElementRef<HTMLInputElement>;
  @ViewChild('invoiceInput') private invoiceInput?: ElementRef<HTMLInputElement>;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly importLoading = signal(false);
  readonly importResult = signal<string | null>(null);
  readonly importError = signal<string | null>(null);
  readonly importsLoading = signal(false);
  readonly importsError = signal<string | null>(null);
  readonly importBatches = signal<InterventionImportBatch[]>([]);
  readonly syncLatestOnLoad = signal(false);
  readonly ticketsLoading = signal(false);
  readonly ticketsError = signal<string | null>(null);
  readonly importTickets = signal<InterventionImportTicket[]>([]);
  readonly resetLoading = signal(false);
  readonly resetResult = signal<string | null>(null);
  readonly resetError = signal<string | null>(null);
  readonly resetModalOpen = signal(false);
  readonly viewCleared = signal(false);
  readonly rateSaving = signal(false);
  readonly rateSuccess = signal<string | null>(null);
  readonly rateError = signal<string | null>(null);
  readonly showRates = signal(true);
  readonly invoiceLoading = signal(false);
  readonly invoiceResetLoading = signal(false);
  readonly invoiceResetModalOpen = signal(false);
  readonly invoiceResult = signal<string | null>(null);
  readonly invoiceError = signal<string | null>(null);
  readonly compareLoading = signal(false);
  readonly compareError = signal<string | null>(null);
  readonly invoiceSummary = signal<InterventionInvoiceSummary | null>(null);
  readonly lastImportedInvoices = signal<InterventionInvoiceSummary['invoices']>([]);
  readonly compareResult = signal<InterventionCompare | null>(null);
  readonly selectedPeriodKey = signal<string>('');

  readonly summaryItems = signal<InterventionSummaryItem[]>([]);
  readonly summaryAllItems = signal<InterventionSummaryItem[]>([]);
  readonly totals = signal<InterventionTotals | null>(null);
  readonly totalItems = signal(0);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly pageRange = formatPageRange;
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly detailItems = signal<InterventionItem[]>([]);
  readonly detailTotal = signal(0);
  readonly detailPage = signal(1);
  readonly detailLimit = signal(20);
  readonly detailTechnician = signal<string | null>(null);
  readonly revenueItems = signal<InterventionItem[]>([]);
  readonly revenueItemsLoaded = signal(false);
  readonly revenueItemsLoading = signal(false);
  readonly revenueError = signal<string | null>(null);
  readonly latestImport = computed(() => this.importBatches()[0] || null);
  readonly detailSummaryPrestations = DETAIL_SUMMARY_PRESTATIONS;
  readonly detailGroups = computed(() => {
    const items = this.detailItems();
    const order = DETAIL_GROUP_ORDER;
    const buckets = new Map(order.map((group) => [group.key, [] as InterventionItem[]]));

    for (const item of items) {
      const codes = extractImportedArticleCodes(item);
      const key = order.find((group) => group.key !== 'other' && codes.includes(group.key))?.key || 'other';
      (buckets.get(key) || buckets.get('other'))?.push(item);
    }

    return order
      .map((group) => ({ ...group, items: buckets.get(group.key) || [] }))
      .filter((group) => group.items.length > 0);
  });

  private isReconnectionItem(item: InterventionItem): boolean {
    if (isSfrB2bMarque(item.marque)) return false;
    const statusNormalized = normalizeInterventionText(item.statut);
    if (!(statusNormalized.includes('CLOTURE') && statusNormalized.includes('TERMINEE'))) return false;
    const typeNormalized = normalizeInterventionText(item.type);
    return hasReconnexionInArticles(item.articlesRaw)
      || typeNormalized === 'RECO';
  }

  ticketTechLabel(ticket: InterventionImportTicket): string {
    const first = ticket.techFirstName || '';
    const last = ticket.techLastName || '';
    const combined = `${first} ${last}`.trim();
    return combined || ticket.techFull || '—';
  }

  downloadLatestImport(): void {
    const batch = this.latestImport();
    const id = batch?._id;
    if (!id) return;
    const filename = (batch?.originalName || batch?.storedName || 'import.csv').trim();
    this.svc.downloadImport(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.importsError.set(this.apiError(err, 'Erreur téléchargement CSV'));
      }
    });
  }

  readonly filters = signal<InterventionFilters>({
    regions: [],
    clients: [],
    statuses: [],
    technicians: [],
    types: []
  });
  readonly prestationTypeOptions = [
    { label: 'RACPAV', value: 'RACPAV' },
    ...INTERVENTION_PRESTATION_FIELDS
      .filter((field) => !this.hiddenPrestationCodes.has(field.code))
      .map((field) => ({
        label: field.code,
        value: field.code
      }))
  ].filter((option, index, self) => self.findIndex((item) => item.value === option.value) === index);
  readonly depots = signal<Depot[]>([]);
  readonly employees = signal<EmployeeSummary[]>([]);
  readonly contractTypes = INTERVENTION_CONTRACT_TYPES;
  readonly quickSummarySourceItems = computed(() => {
    if (!this.revenueItemsLoaded()) return [] as InterventionItem[];
    const items = this.revenueItems();
    const selectedCode = this.selectedRevenueCode();
    if (!selectedCode) return items;
    return items.filter((item) => this.matchesQuickSummarySelection(item, selectedCode));
  });
  readonly quickSummaryTotal = computed(() => {
    if (this.revenueItemsLoaded()) return this.quickSummarySourceItems().length;
    return this.totals()?.total ?? 0;
  });
  readonly quickSummaryPrestations = computed(() =>
    QUICK_SUMMARY_PRESTATIONS.map((item) => ({
      ...item,
      value: this.quickSummaryValue(item)
    }))
  );

  readonly averagePerTech = computed(() => {
    const items = this.summaryItems();
    const total = this.totals()?.total ?? items.reduce((acc, it) => acc + (it.total || 0), 0);
    if (!items.length) return 0;
    return Math.round(total / items.length);
  });

  readonly rejectRate = computed(() => {
    const latest = this.latestImport();
    const totalCreated = latest?.totals?.created ?? 0;
    const rejected = latest?.totals?.rejected ?? 0;
    return totalCreated ? Math.round((rejected / totalCreated) * 100) : 0;
  });

  readonly openTickets = computed(() => this.importTickets().length);

  readonly reconnectionShare = computed(() => {
    const totals = this.totals();
    const reconnection = totals?.reconnexion ?? 0;
    const total = totals?.total ?? 0;
    return total ? Math.round((reconnection / total) * 100) : 0;
  });

  readonly revenueGap = computed(() => {
    const compare = this.compareTotals();
    if (!compare) return 0;
    return Math.round(compare.delta);
  });

  readonly filterForm = this.fb.nonNullable.group({
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control(''),
    technician: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
    contractType: this.fb.nonNullable.control(''),
    region: this.fb.nonNullable.control(''),
    client: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control('CLOTURE TERMINEE'),
    type: this.fb.nonNullable.control('')
  });

  readonly hasData = computed(() => this.summaryItems().length > 0 || Boolean(this.latestImport()));
  readonly initialLoading = computed(() => this.loading() && !this.error());
  readonly canEditRates = computed(() => this.auth.hasRole([Role.ADMIN, Role.DIRIGEANT]));
  readonly formatVersionsLoading = signal(false);
  readonly formatVersionsResult = signal<string | null>(null);
  readonly formatVersionsError = signal<string | null>(null);
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

  readonly rateFields = INTERVENTION_PRESTATION_FIELDS;

  private readonly revenueKeys = new Set(REVENUE_KEYS);

  private readonly rateCodeMap = (() => {
    const entries = this.rateFields
      .filter((field) => this.revenueKeys.has(field.key))
      .map((field) => [field.code, field.key as keyof InterventionRates] as const);
    const map = new Map<string, keyof InterventionRates>(entries);
    for (const [legacyCode, canonicalCode] of REVENUE_CODE_ALIASES.entries()) {
      const key = map.get(canonicalCode);
      if (key) map.set(legacyCode, key);
    }
    return map;
  })();

  readonly rateForm = this.fb.nonNullable.group({
    racPavillon: this.fb.nonNullable.group({
      total: [140, [Validators.required, Validators.min(0)]],
      fxn: [10, [Validators.required, Validators.min(0)]]
    }),
    racSouterrain: this.fb.nonNullable.group({
      total: [140, [Validators.required, Validators.min(0)]],
      fxn: [10, [Validators.required, Validators.min(0)]]
    }),
    racAerien: this.fb.nonNullable.group({
      total: [215, [Validators.required, Validators.min(0)]],
      fxn: [10, [Validators.required, Validators.min(0)]]
    }),
    racFacade: this.fb.nonNullable.group({
      total: [160, [Validators.required, Validators.min(0)]],
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
    fourreauBeton: this.fb.nonNullable.group({
      total: [450, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    prestaCompl: this.fb.nonNullable.group({
      total: [50, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    deplacementPrise: this.fb.nonNullable.group({
      total: [20, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    deplacementOffert: this.fb.nonNullable.group({
      total: [10, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    deplacementATort: this.fb.nonNullable.group({
      total: [10, [Validators.required, Validators.min(0)]],
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
    savExp: this.fb.nonNullable.group({
      total: [0, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    swapEquipement: this.fb.nonNullable.group({
      total: [10, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    refrac: this.fb.nonNullable.group({
      total: [0, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    refcDgr: this.fb.nonNullable.group({
      total: [50, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    cableSl: this.fb.nonNullable.group({
      total: [0.30, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    bifibre: this.fb.nonNullable.group({
      total: [5, [Validators.required, Validators.min(0)]],
      fxn: [0, [Validators.required, Validators.min(0)]]
    }),
    nacelle: this.fb.nonNullable.group({
      total: [-80, [Validators.required]],
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
    const rates = this.normalizePricingRates(this.ratesService.rates());
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
  readonly displayedInvoices = computed(() => {
    const last = this.lastImportedInvoices();
    if (last.length) return last;
    const invoices = this.invoiceSummary()?.invoices || [];
    const period = this.selectedPeriodKey();
    return period ? invoices.filter((inv) => inv.periodKey === period) : invoices;
  });
  readonly invoiceTotalHt = computed(() => {
    return this.displayedInvoices().reduce((acc, inv) => acc + Number(inv.totalHt || 0), 0);
  });
  readonly compareTotals = computed(() => {
    const rows = this.compareRows();
    const invoiceTotal = this.invoiceTotalHt();
    if (!rows.length) {
      return invoiceTotal
        ? {
            osiris: 0,
            invoice: invoiceTotal,
            delta: -invoiceTotal
          }
        : null;
    }
    const osirisTotal = rows.reduce((acc, row) => acc + Number(row.osirisAmount || 0), 0);
    return {
      osiris: osirisTotal,
      invoice: invoiceTotal,
      delta: osirisTotal - invoiceTotal
    };
  });
  readonly compareRows = computed(() => {
    const totals = this.totals();
    const rates = this.rates();
    const compare = this.compareResult();
    const selectedCode = this.selectedRevenueCode();
    const selectedKey = this.selectedRevenueKey();
    if (!totals) {
      const rows = compare?.rows || [];
      return rows
        .filter((row) => String(row.code || '').toLowerCase() !== 'other')
        .filter((row) => !selectedKey || this.rateCodeMap.get(String(row.code || '')) === selectedKey);
    }
    const invoiceMap = new Map<string, { qty: number; amount: number }>();
    for (const row of compare?.rows || []) {
      const code = String(row.code || '');
      invoiceMap.set(code, { qty: Number(row.invoiceQty || 0), amount: Number(row.invoiceAmount || 0) });
    }
    const rows = INTERVENTION_PRESTATION_FIELDS.map((field) => {
      const qty = Number((totals as Record<string, number>)[field.key] || 0);
      const rate = rates[field.key];
      const osirisAmount = qty * Number(rate?.total || 0);
      const invoice = invoiceMap.get(field.code) || { qty: 0, amount: 0 };
      return {
        code: field.code,
        osirisQty: qty,
        invoiceQty: invoice.qty,
        deltaQty: qty - invoice.qty,
        osirisAmount,
        invoiceAmount: invoice.amount,
        deltaAmount: osirisAmount - invoice.amount
      };
    }).filter((row) => row.osirisQty || row.invoiceQty)
      .filter((row) => !selectedKey || this.rateCodeMap.get(row.code) === selectedKey);
    return rows;
  });

  constructor() {
    const stored = localStorage.getItem(this.RATES_VIS_KEY);
    if (stored != null) {
      this.showRates.set(stored !== 'false');
    }
    this.loadFilters();
    this.loadDepots();
    this.loadEmployees();
    this.loadImports();
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

  exportSummaryCsv(): void {
    this.svc.exportCsv(this.buildSummaryQuery()).subscribe({
      next: (blob) => downloadBlob(blob, `interventions-techniciens-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => this.error.set('Erreur export CSV')
    });
  }

  exportSummaryPdf(): void {
    this.svc.exportPdf(this.buildSummaryQuery()).subscribe({
      next: (blob) => downloadBlob(blob, `interventions-techniciens-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => this.error.set('Erreur export PDF')
    });
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
    this.setDetailLimitValue(v);
  }

  setDetailLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.detailLimit.set(value);
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
    this.resetFileInput();
  }

  onInvoiceClick(): void {
    this.resetInvoiceInput();
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
          const data = res.data as {
            total?: number;
            created?: number;
            updated?: number;
            versioned?: number;
            rejected?: number;
            tickets?: number;
            success?: number;
            failure?: number;
          } | undefined;
          const total = data?.total ?? 0;
          const created = data?.created ?? 0;
          const versioned = data?.versioned ?? (data?.updated ?? 0);
          const rejected = data?.rejected ?? 0;
          const tickets = data?.tickets ?? 0;
          const success = data?.success ?? 0;
          const failure = data?.failure ?? 0;
          if (total > 0) {
            this.importResult.set(
              `Import terminé. Total: ${total}. Succès: ${success}. Échec: ${failure}. Créées: ${created}. Versionnées: ${versioned}. Rejetées: ${rejected}. Tickets: ${tickets}.`
            );
          } else {
            this.importResult.set('Import terminé.');
          }
          this.syncLatestOnLoad.set(true);
          this.resetFileInput();
          this.loadFilters();
          this.loadImports();
          this.loadTickets();
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

  loadImports(): void {
    this.importsLoading.set(true);
    this.importsError.set(null);
    this.svc.listImports({ page: 1, limit: 5 }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.importsError.set('Erreur chargement imports');
          this.importsLoading.set(false);
          return;
        }
        const items = res.data.items || [];
        this.importBatches.set(items);
        this.importsLoading.set(false);
        const latestId = items[0]?._id;
        if (this.syncLatestOnLoad()) {
          this.syncLatestOnLoad.set(false);
          this.applyImportPeriod(items[0] || null);
        }
        this.loadTickets(latestId);
      },
      error: (err) => {
        this.importsLoading.set(false);
        this.importsError.set(this.apiError(err, 'Erreur chargement imports'));
      }
    });
  }

  loadTickets(importBatchId?: string): void {
    this.ticketsLoading.set(true);
    this.ticketsError.set(null);
    const query: { page: number; limit: number; status: string; importBatchId?: string } = {
      page: 1,
      limit: 20,
      status: 'OPEN'
    };
    if (importBatchId) query.importBatchId = importBatchId;
    this.svc.listImportTickets(query).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.ticketsError.set('Erreur chargement tickets');
          this.ticketsLoading.set(false);
          return;
        }
        this.importTickets.set(res.data.items || []);
        this.ticketsLoading.set(false);
      },
      error: (err) => {
        this.ticketsLoading.set(false);
        this.ticketsError.set(this.apiError(err, 'Erreur chargement tickets'));
      }
    });
  }

  private applyImportPeriod(batch: InterventionImportBatch | null): void {
    if (!batch) return;
    const toDateInput = (value?: string) => {
      if (!value) return '';
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
    };
    const fromDate = toDateInput(batch.periodStart || batch.importedAt || batch.createdAt);
    const toDate = toDateInput(batch.periodEnd || batch.periodStart || batch.importedAt || batch.createdAt);
    if (!fromDate && !toDate) return;
    this.filterForm.patchValue({
      fromDate: fromDate || '',
      toDate: toDate || ''
    });
    this.page.set(1);
    this.refresh();
    this.refreshCompare();
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
          const data = res.data as {
            imported?: number;
            skipped?: number;
            updated?: number;
            invoices?: InterventionInvoiceSummary['invoices'];
          } | undefined;
          const imported = data?.imported ?? 0;
          const skipped = data?.skipped ?? 0;
          const updated = data?.updated ?? 0;
          this.invoiceResult.set(`Factures importées : ${imported}. Mises à jour : ${updated}. Ignorées : ${skipped}.`);
          const importedInvoices = data?.invoices || [];
          this.lastImportedInvoices.set(importedInvoices);
          if (importedInvoices.length) {
            const firstPeriod = importedInvoices.find((inv) => inv.periodKey)?.periodKey || '';
            if (firstPeriod) {
              this.selectedPeriodKey.set(firstPeriod);
            }
          }
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

  resetInvoices(): void {
    if (!this.invoiceSummary()?.invoices?.length && !this.selectedInvoices.length) {
      this.invoiceResult.set('Aucune facture à vider.');
      this.invoiceError.set(null);
      return;
    }
    this.invoiceResetModalOpen.set(true);
  }

  closeInvoiceResetModal(): void {
    if (this.invoiceResetLoading()) return;
    this.invoiceResetModalOpen.set(false);
  }

  confirmResetInvoices(): void {
    this.invoiceResetModalOpen.set(false);
    this.invoiceResetLoading.set(true);
    this.invoiceError.set(null);
    this.invoiceResult.set(null);
    this.svc.resetInvoices().subscribe({
      next: (res) => {
        this.invoiceResetLoading.set(false);
        const deleted = Number(res.data?.deleted || 0);
        this.invoiceSummary.set({ totalHt: 0, byCode: {}, invoices: [] });
        this.lastImportedInvoices.set([]);
        this.selectedPeriodKey.set('');
        this.compareResult.set(null);
        this.compareError.set(null);
        this.resetInvoiceInput();
        this.refreshCompare();
        this.invoiceResult.set(`Factures supprimées : ${deleted}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.invoiceResetLoading.set(false);
        this.invoiceError.set(this.apiError(err, 'Erreur suppression factures'));
      }
    });
  }

  runFormatVersions(): void {
    this.formatVersionsLoading.set(true);
    this.formatVersionsResult.set(null);
    this.formatVersionsError.set(null);
    this.svc.formatVersions().subscribe({
      next: (res) => {
        this.formatVersionsLoading.set(false);
        this.formatVersionsResult.set(
          `Formatage terminé — ${res.data.backfilled} version(s) créée(s), ${res.data.skipped} déjà existante(s).`
        );
      },
      error: (err: HttpErrorResponse) => {
        this.formatVersionsLoading.set(false);
        this.formatVersionsError.set(this.apiError(err, 'Erreur formatage versions'));
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
    this.viewCleared.set(true);
    this.summaryItems.set([]);
    this.totals.set(null);
    this.totalItems.set(0);
    this.detailItems.set([]);
    this.detailTotal.set(0);
    this.detailOpen.set(false);
    this.detailError.set(null);
    this.importBatches.set([]);
    this.importTickets.set([]);
    this.importResult.set(null);
    this.importError.set(null);
    this.importsError.set(null);
    this.ticketsError.set(null);
    this.invoiceSummary.set(null);
    this.lastImportedInvoices.set([]);
    this.compareResult.set(null);
    this.selectedPeriodKey.set('');
    this.invoiceResult.set(null);
    this.invoiceError.set(null);
    this.compareError.set(null);
    this.resetFileInput();
    this.resetInvoiceInput();
    this.resetLoading.set(false);
    this.resetResult.set('Affichage réinitialisé (aucune donnée supprimée).');
  }

  refresh(): void {
    this.viewCleared.set(false);
    const summaryQuery = this.buildSummaryQuery();
    this.loading.set(true);
    this.error.set(null);
    this.revenueItems.set([]);
    this.revenueItemsLoaded.set(false);
    this.revenueItemsLoading.set(true);
    this.revenueError.set(null);

    this.svc.summary({
      ...summaryQuery,
      page: 1,
      limit: 1000
    }).subscribe({
      next: (res) => {
        const items = (res.data.items || [])
          .map((item) => this.normalizeSummaryItem(item))
          .filter((item): item is InterventionSummaryItem => item !== null);
        const filteredItems = this.applyAdvancedFilters(items);
        const pagedItems = this.paginateSummaryItems(filteredItems);
        const totals = this.computeTotals(filteredItems);
        this.summaryAllItems.set(filteredItems);
        this.summaryItems.set(pagedItems);
        this.totals.set(totals);
        this.totalItems.set(filteredItems.length);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement indicateurs'));
      }
    });
    this.loadRevenueItems();
  }

  private loadInvoices(): void {
    this.svc.invoiceSummary().subscribe({
      next: (res) => {
        this.invoiceSummary.set(res.data);
        const options = this.periodOptions();
        const current = this.selectedPeriodKey();
        const stillValid = options.some((opt) => opt.key === current);
        if ((!current || !stillValid) && options.length) {
          this.selectedPeriodKey.set(options[0].key);
        }
        this.refreshCompare();
      },
      error: () => {}
    });
  }

  refreshCompare(): void {
    const summaryQuery = this.buildSummaryQuery();
    this.compareLoading.set(true);
    this.compareError.set(null);
    const invoiceIds = this.lastImportedInvoices()
      .map((inv) => inv._id)
      .filter((id): id is string => Boolean(id));
    this.svc.compare({
      ...summaryQuery,
      periodKey: invoiceIds.length ? undefined : (this.selectedPeriodKey() || undefined),
      invoiceIds: invoiceIds.length ? invoiceIds : undefined
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
    this.lastImportedInvoices.set([]);
    this.refreshCompare();
  }

  private loadDetail(): void {
    const tech = this.detailTechnician();
    if (!tech) return;
    const summaryQuery = this.buildSummaryQuery();
    this.detailLoading.set(true);
    this.detailError.set(null);

    this.svc.list({
      ...summaryQuery,
      technician: tech,
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

  private revenueRequestId = 0;

  private async loadRevenueItems(): Promise<void> {
    const requestId = ++this.revenueRequestId;
    const selectedCode = this.selectedRevenueCode();
    const baseQuery = { ...this.buildSummaryQuery() };
    if (selectedCode === 'RECOIP') {
      baseQuery.type = undefined;
    }
    const limit = 500;
    let page = 1;
    let total = 0;
    const items: InterventionItem[] = [];

    try {
      do {
        const res = await firstValueFrom(this.svc.list({ ...baseQuery, page, limit }));
        if (requestId !== this.revenueRequestId) return;
        const pageItems = res.data.items || [];
        items.push(...pageItems);
        total = res.data.total ?? items.length;
        page += 1;
      } while ((page - 1) * limit < total);

      if (requestId !== this.revenueRequestId) return;
      this.revenueItems.set(items);
      this.applyReconnectionTotalsIfNeeded(items);
    } catch (err) {
      if (requestId !== this.revenueRequestId) return;
      this.revenueItems.set([]);
      this.revenueError.set(this.apiError(err as HttpErrorResponse, 'Erreur chargement revenus'));
    } finally {
      if (requestId !== this.revenueRequestId) return;
      this.revenueItemsLoaded.set(true);
      this.revenueItemsLoading.set(false);
    }
  }

  private applyReconnectionTotalsIfNeeded(items: InterventionItem[]): void {
    const selectedCode = this.selectedRevenueCode();
    if (selectedCode !== 'RECOIP') return;
    const count = items.reduce((acc, item) => acc + (this.isReconnectionItem(item) ? 1 : 0), 0);
    const totals: InterventionTotals = {
      total: count,
      racPavillon: 0,
      racImmeuble: 0,
      reconnexion: count,
      racF8: 0,
      racProS: 0,
      racProC: 0,
      prestaCompl: 0,
      sav: 0,
      clem: 0,
      deplacementPrise: 0,
      demo: 0,
      refrac: 0,
      refcDgr: 0,
      savExp: 0,
      cableSl: 0,
      racAutre: 0,
      other: 0
    };
    this.totals.set(totals);
  }

  private buildSummaryQuery(): InterventionSummaryQuery {
    const f = this.filterForm.getRawValue();
    return {
      ...this.emptySummaryFilters,
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      technician: f.technician || undefined,
      region: f.region || undefined,
      client: f.client || undefined,
      status: this.resolveStatusFilter(f.status || '', f.type || ''),
      type: f.type || undefined
    };
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
    if (item.prestaCompl == null && typeof raw['presta_compl'] === 'number') {
      (item as { prestaCompl?: number }).prestaCompl = raw['presta_compl'] as number;
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
      depot: '',
      contractType: '',
      region: '',
      client: '',
      status: 'CLOTURE TERMINEE',
      type: ''
    });
    this.page.set(1);
    this.refresh();
    this.refreshCompare();
  }

  private loadDepots(): void {
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => this.depots.set(res.items ?? []),
      error: () => this.depots.set([])
    });
  }

  private loadEmployees(): void {
    this.hrService.listEmployees({ role: 'TECHNICIEN', page: 1, limit: 1000 }).subscribe({
      next: (res) => this.employees.set(res.items ?? []),
      error: () => this.employees.set([])
    });
  }

  private applyAdvancedFilters(items: InterventionSummaryItem[]): InterventionSummaryItem[] {
    const f = this.filterForm.getRawValue();
    const depotId = f.depot || '';
    const contractType = f.contractType || '';
    if (!depotId && !contractType) return items;
    if (!this.employees().length) return items;
    const metaMap = this.buildTechMetaMap();
    return items.filter((item) => {
      const key = this.normalizeLabel(item.technician || '');
      const meta = metaMap.get(key);
      if (!meta) return false;
      if (depotId && meta.depotId !== depotId) return false;
      if (contractType && meta.contractType !== contractType) return false;
      return true;
    });
  }

  private paginateSummaryItems(items: InterventionSummaryItem[]): InterventionSummaryItem[] {
    const page = this.page();
    const limit = this.limit();
    if (!items.length || limit <= 0) return items;
    const start = (page - 1) * limit;
    return items.slice(start, start + limit);
  }

  private computeTotals(items: InterventionSummaryItem[]): InterventionTotals {
    const totals: InterventionTotals = {
      total: 0,
      racPavillon: 0,
      racSouterrain: 0,
      racAerien: 0,
      racFacade: 0,
      racImmeuble: 0,
      reconnexion: 0,
      racF8: 0,
      fourreauBeton: 0,
      racProS: 0,
      racProC: 0,
      prestaCompl: 0,
      sav: 0,
      clem: 0,
      deprise: 0,
      deplacementOffert: 0,
      deplacementATort: 0,
      demo: 0,
      refrac: 0,
      refcDgr: 0,
      savExp: 0,
      cablePav1: 0,
      cablePav2: 0,
      cablePav3: 0,
      cablePav4: 0,
      swapEquipement: 0,
      bifibre: 0,
      nacelle: 0,
      racAutre: 0,
      other: 0
    };
    for (const item of items) {
      totals.total = (totals.total ?? 0) + (item.total || 0);
      totals.racPavillon = (totals.racPavillon ?? 0) + (item.racPavillon || 0);
      totals.racSouterrain = (totals.racSouterrain ?? 0) + (item.racSouterrain || 0);
      totals.racAerien = (totals.racAerien ?? 0) + (item.racAerien || 0);
      totals.racFacade = (totals.racFacade ?? 0) + (item.racFacade || 0);
      totals.racImmeuble = (totals.racImmeuble ?? 0) + (item.racImmeuble || 0);
      totals.reconnexion = (totals.reconnexion ?? 0) + (item.reconnexion || 0);
      totals.racF8 = (totals.racF8 ?? 0) + (item.racF8 || 0);
      totals.fourreauBeton = (totals.fourreauBeton ?? 0) + (item.fourreauBeton || 0);
      totals.racProS = (totals.racProS ?? 0) + (item.racProS || 0);
      totals.racProC = (totals.racProC ?? 0) + (item.racProC || 0);
      totals.prestaCompl = (totals.prestaCompl ?? 0) + (item.prestaCompl || 0);
      totals.sav = (totals.sav ?? 0) + (item.sav || 0);
      totals.clem = (totals.clem ?? 0) + (item.clem || 0);
      totals.deprise = (totals.deprise ?? 0) + (item.deprise || 0);
      totals.deplacementOffert = (totals.deplacementOffert ?? 0) + (item.deplacementOffert || 0);
      totals.deplacementATort = (totals.deplacementATort ?? 0) + (item.deplacementATort || 0);
      totals.demo = (totals.demo ?? 0) + (item.demo || 0);
      totals.refrac = (totals.refrac ?? 0) + (item.refrac || 0);
      totals.refcDgr = (totals.refcDgr ?? 0) + (item.refcDgr || 0);
      totals.savExp = (totals.savExp ?? 0) + (item.savExp || 0);
      totals.cablePav1 = (totals.cablePav1 ?? 0) + (item.cablePav1 || 0);
      totals.cablePav2 = (totals.cablePav2 ?? 0) + (item.cablePav2 || 0);
      totals.cablePav3 = (totals.cablePav3 ?? 0) + (item.cablePav3 || 0);
      totals.cablePav4 = (totals.cablePav4 ?? 0) + (item.cablePav4 || 0);
      totals.swapEquipement = (totals.swapEquipement ?? 0) + (item.swapEquipement || 0);
      totals.bifibre = (totals.bifibre ?? 0) + (item.bifibre || 0);
      totals.nacelle = (totals.nacelle ?? 0) + (item.nacelle || 0);
      totals.racAutre = (totals.racAutre ?? 0) + (item.racAutre || 0);
      totals.other = (totals.other ?? 0) + (item.other || 0);
    }
    return totals;
  }

  private quickSummaryValue(item: (typeof QUICK_SUMMARY_PRESTATIONS)[number]): number {
    if ('code' in item) {
      if (!this.revenueItemsLoaded()) return 0;
      return this.quickSummarySourceItems().reduce((acc, intervention) => {
        return acc + (this.hasExactSummaryCode(intervention, item.code) ? 1 : 0);
      }, 0);
    }
    if (this.revenueItemsLoaded()) {
      const code = this.summaryKeyToCode(item.key);
      if (!code) return 0;
      return this.quickSummarySourceItems().reduce((acc, intervention) => {
        const codes = resolveBillingCodes(intervention);
        return acc + (codes.includes(code) ? 1 : 0);
      }, 0);
    }
    return Number(this.totals()?.[item.key] ?? 0);
  }

  private hasExactSummaryCode(item: InterventionItem, code: string): boolean {
    const exactCodes = new Set([
      ...extractImportedArticleCodes(item),
      ...extractCodesFromText(item.listePrestationsRaw)
    ]);
    return exactCodes.has(code);
  }

  private matchesQuickSummarySelection(item: InterventionItem, selectedCode: string): boolean {
    if (selectedCode === 'RACPAV' || selectedCode === 'RAC_PBO_SOUT') {
      return this.hasExactSummaryCode(item, selectedCode);
    }
    const codes = resolveBillingCodes(item);
    return codes.includes(selectedCode);
  }

  private summaryKeyToCode(key: string): string | null {
    switch (key) {
      case 'racAerien': return 'RAC_PBO_AERIEN';
      case 'racFacade': return 'RAC_PBO_FACADE';
      case 'racImmeuble': return 'RACIH';
      case 'reconnexion': return 'RECOIP';
      case 'racProS': return 'RACPRO_S';
      case 'racProC': return 'RACPRO_C';
      case 'sav': return 'SAV';
      case 'deplacementOffert': return 'DEPLACEMENT_OFFERT';
      case 'deplacementATort': return 'DEPLACEMENT_A_TORT';
      case 'swapEquipement': return 'SWAP_EQUIPEMENT';
      default: return null;
    }
  }

  private buildTechMetaMap(): Map<string, { depotId?: string; contractType?: string }> {
    const map = new Map<string, { depotId?: string; contractType?: string }>();
    for (const entry of this.employees()) {
      const user = entry.user as User | undefined;
      if (!user) continue;
      const label = this.normalizeLabel(formatPersonName(user.firstName ?? '', user.lastName ?? '') || user.email || '');
      if (!label) continue;
      const depotId = typeof user.idDepot === 'string'
        ? user.idDepot
        : (user.idDepot && typeof user.idDepot === 'object' ? String(user.idDepot._id || '') : '');
      const contractType = entry.profile?.contractType || '';
      map.set(label, { depotId: depotId || undefined, contractType: contractType || undefined });
    }
    return map;
  }

  private normalizeLabel(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  saveRates(): void {
    const raw = this.normalizePricingRates(this.rateForm.getRawValue() as InterventionRates);
    if (!this.rateForm.valid) {
      this.rateSuccess.set(null);
      this.rateError.set('Vérifie les prix saisis avant d’enregistrer.');
      this.rateForm.markAllAsTouched();
      return;
    }
    this.rateSaving.set(true);
    this.rateSuccess.set(null);
    this.rateError.set(null);
    this.ratesService.save(raw).subscribe({
      next: () => {
        this.rateSaving.set(false);
        this.rateSuccess.set('Prix enregistrés.');
        this.rateForm.markAsPristine();
        setTimeout(() => {
          if (this.rateSuccess()) this.rateSuccess.set(null);
        }, 3000);
      },
      error: (err: HttpErrorResponse) => {
        this.rateSaving.set(false);
        this.rateError.set(this.apiError(err, 'Erreur enregistrement prix'));
      }
    });
  }

  resetRates(): void {
    this.rateSuccess.set(null);
    this.rateError.set(null);
    const rates = this.normalizePricingRates(this.ratesService.rates());
    this.rateForm.patchValue(rates, { emitEvent: false });
    this.rateForm.markAsPristine();
    this.rateSuccess.set('Prix réinitialisés.');
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
    this.setLimitValue(v);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh();
  }

  racTotal(item: InterventionSummaryItem | InterventionTotals | null): number {
    if (!item) return 0;
    return (item.racPavillon || 0)
      + (item.racImmeuble || 0)
      + (item.racProS || 0)
      + (item.racProC || 0)
      + (item.deprise || 0)
      + (item.refrac || 0)
      + (item.refcDgr || 0);
  }

  estimatedRevenue(item: InterventionSummaryItem | InterventionTotals | null): number {
    if (!item) return 0;
    const rates = this.rates();
    return this.sumRevenue(item, rates);
  }

  totalRevenue = computed(() => {
    const selectedCode = this.selectedRevenueCode();
    const selectedKey = this.selectedRevenueKey();
    const totals = this.totals();
    if (!selectedCode && totals) {
      return this.estimatedRevenue(totals);
    }
    if (selectedCode && selectedKey && (selectedCode === 'RACPAV' || selectedCode === 'RAC_PBO_SOUT')) {
      const rate = this.rates()[selectedKey];
      return this.quickSummarySourceItems().length * Number(rate?.total || 0);
    }
    if (this.revenueItemsLoaded()) {
      const items = selectedCode ? this.quickSummarySourceItems() : this.revenueItems();
      if (!items.length) return 0;
      const rates = this.rates();
      let total = 0;
      for (const item of items) {
        const codes = resolveBillingCodes(item);
        for (const code of codes) {
          const key = this.rateCodeMap.get(code);
          if (!key) continue;
          if (selectedKey && key !== selectedKey) continue;
          const rate = rates[key];
          total += Number(rate?.total || 0);
        }
      }
      return total;
    }

    if (totals) {
      return this.estimatedRevenueByCode(totals, selectedCode);
    }
    const summary = this.summaryItems();
    let total = 0;
    for (const it of summary) {
      total += this.estimatedRevenueByCode(it, selectedCode);
    }
    return total;
  });

  private selectedRevenueCode(): string | null {
    const raw = this.filterForm.getRawValue().type || '';
    if (!raw) return null;
    const normalized = normalizeInterventionText(raw);
    if (!normalized) return null;
    const mapped = REVENUE_CODE_ALIASES.get(normalized);
    if (mapped) return mapped;
    const underscored = normalized.replace(/\s+/g, '_');
    if (this.rateCodeMap.has(underscored)) return underscored;
    if (this.rateCodeMap.has(normalized)) return normalized;
    return null;
  }

  private selectedRevenueKey(): keyof InterventionRates | null {
    const code = this.selectedRevenueCode();
    if (!code) return null;
    if (code === 'RACPAV') return 'racPavillon';
    if (code === 'RAC_PBO_SOUT') return 'racSouterrain';
    return this.rateCodeMap.get(code) ?? null;
  }

  private resolveStatusFilter(status: string, type: string): string | undefined {
    const normalizedType = normalizeInterventionText(type);
    if (normalizedType.includes('RECO')) {
      return undefined;
    }
    return status || undefined;
  }

  private estimatedRevenueByCode(item: InterventionSummaryItem | InterventionTotals, code: string | null): number {
    if (!code) return this.estimatedRevenue(item);
    const rates = this.rates();
    const key = this.rateCodeMap.get(code);
    if (!key) return 0;
    const qty = Number((item as any)[key] || 0);
    const rate = rates[key];
    return qty * Number(rate?.total || 0);
  }

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
    rates: InterventionRates
  ): number {
    const get = (value?: number) => value ?? 0;
    const amount = (entry: { total: number; fxn: number }) => entry.total || 0;

    return (
      get(item.racPavillon) * amount(rates.racPavillon) +
      get(item.racSouterrain) * amount(rates.racSouterrain) +
      get(item.racAerien) * amount(rates.racAerien) +
      get(item.racFacade) * amount(rates.racFacade) +
      get(item.clem) * amount(rates.clem) +
      get(item.reconnexion) * amount(rates.reconnexion) +
      get(item.racImmeuble) * amount(rates.racImmeuble) +
      get(item.racProS) * amount(rates.racProS) +
      get(item.racProC) * amount(rates.racProC) +
      get(item.racF8) * amount(rates.racF8) +
      get(item.fourreauBeton) * amount(rates.fourreauBeton) +
      get(item.prestaCompl) * amount(rates.prestaCompl) +
      get(item.deplacementPrise ?? item.deprise) * amount(rates.deplacementPrise) +
      get(item.deplacementOffert) * amount(rates.deplacementOffert) +
      get(item.deplacementATort) * amount(rates.deplacementATort) +
      get(item.demo) * amount(rates.demo) +
      get(item.sav) * amount(rates.sav) +
      get(item.savExp) * amount(rates.savExp) +
      get(item.swapEquipement) * amount(rates.swapEquipement) +
      get(item.refrac) * amount(rates.refrac) +
      get(item.refcDgr) * amount(rates.refcDgr) +
      get(item.cableSl) * amount(rates.cableSl) +
      get(item.bifibre) * amount(rates.bifibre) +
      get(item.nacelle) * amount(rates.nacelle)
    );
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

  private normalizePricingRates(rates: InterventionRates): InterventionRates {
    return Object.fromEntries(
      Object.entries(rates).map(([key, value]) => [
        key,
        {
          total: Number(value?.total ?? 0),
          fxn: 0
        }
      ])
    ) as InterventionRates;
  }
}
