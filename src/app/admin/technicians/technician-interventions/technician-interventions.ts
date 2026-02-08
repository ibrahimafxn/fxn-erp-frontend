import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import {
  InterventionFilters,
  InterventionItem,
  InterventionService,
  InterventionSummaryQuery,
  InterventionTotals
} from '../../../core/services/intervention.service';
import { InterventionRates, InterventionRatesService } from '../../../core/services/intervention-rates.service';
import { User, Role } from '../../../core/models';
import { UserService } from '../../../core/services/user.service';
import { hasRacpavInArticles, isRacihSuccess, isRacpavSuccess } from '../../../core/utils/intervention-prestations';
import { formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

type TechnicianInterventionStats = {
  total: number;
  success: number;
  failure: number;
  cancelled: number;
  avgDuration: number;
  avgFailureDuration: number;
  successRate: number;
  topTechnicians: Array<{ label: string; success: number; failure: number; cancelled: number }>;
  topTypes: Array<{ label: string; count: number }>;
  topStatuses: Array<{ label: string; count: number }>;
};

const EMPTY_STATS: TechnicianInterventionStats = {
  total: 0,
  success: 0,
  failure: 0,
  cancelled: 0,
  avgDuration: 0,
  avgFailureDuration: 0,
  successRate: 0,
  topTechnicians: [],
  topTypes: [],
  topStatuses: []
};

type SortField = 'date' | 'type' | 'statut' | 'duree';
type InterventionDetailField = { key: keyof InterventionItem; label: string };

const TYPE_CANONICAL_ALIASES = new Map([
  ['RACIH', 'RACIH'],
  ['RAC_IH', 'RACIH'],
  ['RACPAV', 'RACPAV'],
  ['RAC_PAV', 'RACPAV'],
  ['PRESTA COMPL', 'PRESTA_COMPL'],
  ['PRESTA COMPL', 'PRESTA COMPL'],
  ['REPFOU_PRI', 'REPFOU_PRI'],
  ['REPFOU PRI', 'REPFOU_PRI'],
  ['REPFOU-PRI', 'REPFOU_PRI'],
  ['RACC PRO S', 'RACPRO_S'],
  ['RACC PRO_S', 'RACPRO_S'],
  ['RACC PRO-S', 'RACPRO_S'],
  ['RACPRO S', 'RACPRO_S'],
  ['RACPRO_S', 'RACPRO_S'],
  ['RACPRO-S', 'RACPRO_S'],
  ['RACC PRO C', 'RACPRO_C'],
  ['RACC PRO_C', 'RACPRO_C'],
  ['RACC PRO-C', 'RACPRO_C'],
  ['RACPRO C', 'RACPRO_C'],
  ['RACPRO_C', 'RACPRO_C'],
  ['RACPRO-C', 'RACPRO_C'],
  ['RECOIP', 'RECOIP'],
  ['RECO IP', 'RECOIP'],
  ['RECO-IP', 'RECOIP'],
  ['RECO', 'RECOIP'],
  ['SAV', 'SAV'],
  ['CABLE_PAV_1', 'CABLE_PAV_1'],
  ['CABLE_PAV_2', 'CABLE_PAV_2'],
  ['CABLE_PAV_3', 'CABLE_PAV_3'],
  ['CABLE_PAV_4', 'CABLE_PAV_4']
]);
const ARTICLE_TYPE_LABELS = [
  { label: 'PRO S', marker: 'RACPRO_S' },
  { label: 'PRO C', marker: 'RACPRO_C' },
  { label: 'RACPAV', marker: 'RACPAV' },
  { label: 'RACIH', marker: 'RACIH' },
  { label: 'RECO', marker: 'RECOIP' },
  { label: 'CLEM', marker: 'CLEM' },
  { label: 'SAV', marker: 'SAV' },
  { label: 'CABLE PAV 1', marker: 'CABLE_PAV_1' },
  { label: 'CABLE PAV 2', marker: 'CABLE_PAV_2' },
  { label: 'CABLE PAV 3', marker: 'CABLE_PAV_3' },
  { label: 'CABLE PAV 4', marker: 'CABLE_PAV_4' },
  { label: 'PRESTA COMPL', marker: 'PRESTA_COMPL' },
  { label: 'PRESTA F8', marker: 'REPFOU_PRI' }
];
const ARTICLE_TYPE_BY_CODE = new Map([
  ['RACPRO_S', 'PRO S'],
  ['RACPRO_C', 'PRO C'],
  ['RACPAV', 'RACPAV'],
  ['RACIH', 'RACIH'],
  ['RECOIP', 'RECO'],
  ['CLEM', 'CLEM'],
  ['PRESTA_COMPL', 'PRESTA COMPL'],
  ['REPFOU_PRI', 'PRESTA F8'],
  ['SAV', 'SAV'],
  ['CABLE_PAV_1', 'CABLE PAV 1'],
  ['CABLE_PAV_2', 'CABLE PAV 2'],
  ['CABLE_PAV_3', 'CABLE PAV 3'],
  ['CABLE_PAV_4', 'CABLE PAV 4']
]);
const REQUIRED_TYPE_LABELS = ['RECOIP'];

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-technician-interventions',
  templateUrl: './technician-interventions.html',
  styleUrls: ['./technician-interventions.scss']
})
export class TechnicianInterventions {
  private svc = inject(InterventionService);
  private ratesService = inject(InterventionRatesService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  readonly filterLoading = signal(false);
  readonly filtersError = signal<string | null>(null);
  readonly filters = signal<InterventionFilters | null>(null);
  readonly technicians = signal<User[]>([]);
  readonly summaryLoading = signal(false);
  readonly summaryTotals = signal<InterventionTotals | null>(null);

  readonly tableLoading = signal(false);
  readonly tableError = signal<string | null>(null);
  readonly interventions = signal<InterventionItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly detailOpen = signal(false);
  readonly selectedDetail = signal<InterventionItem | null>(null);

  private readonly detailFields: InterventionDetailField[] = [
    { key: '_id', label: 'ID' },
    { key: 'numInter', label: 'Numero' },
    { key: 'dateRdv', label: 'Date RDV' },
    { key: 'region', label: 'Region' },
    { key: 'plaque', label: 'Plaque' },
    { key: 'societe', label: 'Societe' },
    { key: 'techFirstName', label: 'Technicien prenom' },
    { key: 'techLastName', label: 'Technicien nom' },
    { key: 'techFull', label: 'Technicien' },
    { key: 'type', label: 'Type' },
    { key: 'client', label: 'Client' },
    { key: 'statut', label: 'Statut' },
    { key: 'commentairesTechnicien', label: 'Commentaires technicien' },
    { key: 'debut', label: 'Debut' },
    { key: 'duree', label: 'Duree' },
    { key: 'clotureHotline', label: 'Cloture hotline' },
    { key: 'clotureTech', label: 'Cloture tech' },
    { key: 'debutIntervention', label: 'Debut intervention' },
    { key: 'creneauPlus2h', label: 'Creneau +2h' },
    { key: 'motifEchec', label: 'Motif echec' },
    { key: 'ville', label: 'Ville' },
    { key: 'typeLogement', label: 'Type logement' },
    { key: 'actionSav', label: 'Action SAV' },
    { key: 'longueurCable', label: 'Longueur cable' },
    { key: 'typePbo', label: 'Type PBO' },
    { key: 'typeOperation', label: 'Type operation' },
    { key: 'typeHabitation', label: 'Type habitation' },
    { key: 'priseExistante', label: 'Prise existante' },
    { key: 'recoRacc', label: 'Reco/Racc' },
    { key: 'marque', label: 'Marque' },
    { key: 'listePrestationsRaw', label: 'Liste prestations' },
    { key: 'articlesRaw', label: 'Articles' },
    { key: 'categories', label: 'Categories' },
    { key: 'isSuccess', label: 'Succes' },
    { key: 'isFailure', label: 'Echec' },
    { key: 'versionIndex', label: 'Version' },
    { key: 'latestVersionId', label: 'Derniere version ID' },
    { key: 'importedAt', label: 'Importe le' }
  ];

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly pageRange = formatPageRange;
  readonly limitOptions = [10, 20, 50, 100];
  readonly isBusy = computed(() => this.filterLoading() || this.summaryLoading() || this.tableLoading());

  readonly filterForm = this.fb.nonNullable.group({
    technician: this.fb.nonNullable.control(''),
    region: this.fb.nonNullable.control(''),
    client: this.fb.nonNullable.control(''),
    numInter: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control(''),
    type: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly statsDataset = signal<InterventionItem[]>([]);
  readonly stats = computed(() => this.computeStats(this.statsDataset(), this.total(), this.filterForm.controls.type.value));
  readonly failurePercent = computed(() => this.computeFailurePercent(this.stats()));
  readonly successRateBg = computed(() => this.computeSuccessRateBg(this.stats().successRate));
  readonly reconnectionCount = computed(() => this.countMatchingType('RECOIP'));
  readonly sortField = signal<SortField>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly sortedInterventions = computed(() => this.sortedItems());
  readonly typeOptions = computed(() => {
    const types = this.filters()?.types ?? [];
    const mapped = types.map((value) => (value === 'RACC' ? 'RACPAV' : value));
    if (!mapped.includes('RACIH')) {
      mapped.push('RACIH');
    }
    return mapped;
  });
  constructor() {
    this.loadFilters();
    this.loadTechnicians();
    this.loadInterventions();
    this.loadSummary();
    this.ratesService.refresh().subscribe();
  }

  applyFilters(): void {
    this.page.set(1);
    this.ratesService.refresh().subscribe();
    this.loadInterventions();
    this.loadSummary();
  }

  clearFilters(): void {
    this.filterForm.reset({
      technician: '',
      region: '',
      client: '',
      numInter: '',
      status: '',
      type: '',
      fromDate: '',
      toDate: ''
    });
    this.page.set(1);
    this.ratesService.refresh().subscribe();
    this.loadInterventions();
    this.loadSummary();
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.update((value) => value - 1);
    this.loadInterventions();
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.update((value) => value + 1);
    this.loadInterventions();
  }

  setLimit(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.loadInterventions();
  }

  refresh(): void {
    this.clearFilters();
  }

  exportCsv(): void {
    const query = this.buildQuery({ includePagination: false });
    this.svc.exportCsv(query).subscribe({
      next: (blob) => this.downloadBlob(blob, 'interventions-export.csv'),
      error: () => this.tableError.set('Erreur export CSV')
    });
  }

  exportPdf(): void {
    const query = this.buildQuery({ includePagination: false });
    this.svc.exportPdf(query).subscribe({
      next: (blob) => this.downloadBlob(blob, 'interventions-export.pdf'),
      error: () => this.tableError.set('Erreur export PDF')
    });
  }

  saveView(): void {
    this.tableError.set('Sauvegarde de vue à venir.');
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortField.set(field);
    this.sortDirection.set(field === 'date' ? 'desc' : 'asc');
  }

  sortArrow(field: SortField): string {
    if (this.sortField() !== field) return '';
    return this.sortDirection() === 'asc' ? '▲' : '▼';
  }

  private loadFilters(): void {
    this.filterLoading.set(true);
    this.filtersError.set(null);
    this.svc.filters().subscribe({
      next: (res) => {
        this.filterLoading.set(false);
        if (res?.success) {
          this.filters.set(this.ensureCablePavTypes(res.data));
          return;
        }
        this.filtersError.set('Impossible de charger les filtres des interventions.');
      },
      error: (err) => {
        this.filterLoading.set(false);
        this.filtersError.set(this.apiError(err, 'Impossible de charger les filtres des interventions.'));
      }
    });
  }

  private ensureCablePavTypes(filters: InterventionFilters): InterventionFilters {
    const extra = [
      'CABLE_PAV_1',
      'CABLE_PAV_2',
      'CABLE_PAV_3',
      'CABLE_PAV_4',
      'CLEM',
      'RACPRO_S',
      'RACPRO_C'
    ];
    const types = Array.isArray(filters?.types) ? [...filters.types] : [];
    for (const entry of extra) {
      if (!types.includes(entry)) {
        types.push(entry);
      }
    }
    types.sort((a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' }));
    return { ...filters, types };
  }

  private loadTechnicians(): void {
    this.userService.refreshUsers(true, { page: 1, limit: 500, role: Role.TECHNICIEN }).subscribe({
      next: (res) => this.technicians.set(res.items ?? []),
      error: () => this.technicians.set([])
    });
  }

  private loadInterventions(): void {
    this.tableLoading.set(true);
    this.tableError.set(null);
    const pagedQuery = this.buildQuery({ includePagination: true });
    this.svc.list(pagedQuery).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.tableError.set('Impossible de charger les interventions.');
          this.tableLoading.set(false);
          return;
        }
        const items = res.data.items || [];
        const exactEchec = this.isExactEchecFilterActive();
        const strictRacpav = this.isStrictRacpavFilterActive();
        const strictSav = this.isStrictSavFilterActive();
        const listFilteredItems = this.applyStrictListFilters(items);
        const totalFromRes = res.data.total || 0;

        if ((exactEchec || strictRacpav || strictSav) && totalFromRes > items.length) {
          const fullQuery = this.buildQuery({ includePagination: false });
          fullQuery.page = 1;
          fullQuery.limit = totalFromRes;
          this.svc.list(fullQuery).subscribe({
            next: (fullRes) => {
              if (!fullRes?.success) {
                this.tableError.set('Impossible de charger les interventions.');
                this.tableLoading.set(false);
                return;
              }
              const incoming = fullRes.data.items || [];
              const fullListItems = this.applyStrictListFilters(incoming);
              const fullStatsItems = this.applyStrictStatsFilters(incoming);
              const total = fullListItems.length;
              const page = this.page();
              const limit = this.limit();
              const start = (page - 1) * limit;
              const pagedItems = fullListItems.slice(start, start + limit);
              this.interventions.set(pagedItems);
              this.total.set(total);
              this.statsDataset.set(fullStatsItems);
              this.tableLoading.set(false);
            },
            error: (err) => {
              this.tableLoading.set(false);
              this.tableError.set(this.apiError(err, 'Impossible de charger les interventions.'));
            }
          });
          return;
        }

        const total = (exactEchec || strictRacpav || strictSav) ? listFilteredItems.length : totalFromRes;
        const statsSource = (exactEchec || strictRacpav || strictSav) ? items : listFilteredItems;
        this.interventions.set(listFilteredItems);
        this.total.set(total);
        this.updateStatsDataset(statsSource, total, pagedQuery);
        this.tableLoading.set(false);
      },
      error: (err) => {
        this.tableLoading.set(false);
        this.tableError.set(this.apiError(err, 'Impossible de charger les interventions.'));
      }
    });
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    const query = this.buildQuery({ includePagination: false });
    this.svc.summary(query).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.summaryTotals.set(null);
          this.summaryLoading.set(false);
          return;
        }
        this.summaryTotals.set(res.data.totals || null);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryTotals.set(null);
        this.summaryLoading.set(false);
      }
    });
  }

  private buildQuery(options?: { includePagination?: boolean }): InterventionSummaryQuery {
    const filters = this.filterForm.getRawValue();
    const range = this.normalizeDateRange(filters.fromDate, filters.toDate);
    const rawType = filters.type || '';
    const normalizedType = this.normalizeToken(rawType);
    const typeFilter = rawType === 'RACPAV' ? undefined : rawType;
    const statusFilter = normalizedType === 'ECHEC' ? 'ECHEC' : filters.status;
    return {
      technician: filters.technician || undefined,
      region: filters.region || undefined,
      client: filters.client || undefined,
      numInter: filters.numInter || undefined,
      status: statusFilter || undefined,
      type: normalizedType === 'ECHEC' ? undefined : (typeFilter || undefined),
      ...range,
      ...(options?.includePagination ?? true
        ? { page: this.page(), limit: this.limit() }
        : {})
    };
  }

  private normalizeDateRange(from: string, to: string): { fromDate?: string; toDate?: string } {
    const fromDate = from?.trim() || '';
    const toDate = to?.trim() || '';
    return {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined
    };
  }

  private isExactEchecFilterActive(): boolean {
    const rawFilters = this.filterForm.getRawValue();
    const rawType = rawFilters.type || '';
    const rawStatus = rawFilters.status || '';
    return this.normalizeToken(rawType) === 'ECHEC' || this.normalizeToken(rawStatus) === 'ECHEC';
  }

  private isExactEchecStatus(status?: string | null): boolean {
    const normalized = this.normalizeToken(status);
    return normalized.includes('ECHEC') && !normalized.includes('TERMINE');
  }

  private isStrictRacpavFilterActive(): boolean {
    const rawType = this.filterForm.getRawValue().type || '';
    return this.normalizeToken(rawType) === 'RACPAV';
  }

  private isStrictSavFilterActive(): boolean {
    const rawType = this.filterForm.getRawValue().type || '';
    return this.normalizeToken(rawType) === 'SAV';
  }

  private isStrictPrestaComplFilterActive(): boolean {
    const rawType = this.filterForm.getRawValue().type || '';
    return this.normalizeToken(rawType) === 'PRESTA_COMPL';
  }

  private isPavillonHousing(value?: string | null): boolean {
    const normalized = this.normalizeToken(value);
    return normalized.includes('PAVILLON') || normalized === 'PAV';
  }

  private isRacpavType(value?: string | null): boolean {
    const normalized = this.normalizeToken(value);
    return normalized === 'RACC' || normalized === 'RACPAV';
  }

  private applyStrictListFilters(items: InterventionItem[]): InterventionItem[] {
    const exactEchec = this.isExactEchecFilterActive();
    const strictRacpav = this.isStrictRacpavFilterActive();
    const strictSav = this.isStrictSavFilterActive();
    if (!exactEchec && !strictRacpav && !strictSav) return items;
    return items.filter((item) => {
      if (exactEchec && !this.isExactEchecStatus(item.statut)) return false;
      if (strictRacpav) {
        const status = this.normalizeToken(item.statut);
        const isEchecTermine = status.includes('ECHEC') && status.includes('TERMINE');
        const isExactEchec = status.includes('ECHEC') && !status.includes('TERMINE');
        const isCancelled = status.includes('ANNULE');
        const isPavillon = this.isPavillonHousing(item.typeLogement);
        const isRacpavRelated = this.isRacpavType(item.type) || hasRacpavInArticles(item.articlesRaw);
        const isFailureOrCancel = isPavillon && isRacpavRelated && (isExactEchec || isEchecTermine || isCancelled);
        if (!isRacpavSuccess(item.statut, item.articlesRaw) && !isFailureOrCancel) return false;
      }
      if (strictSav && !this.isExactSavItem(item)) return false;
      return true;
    });
  }

  private applyStrictStatsFilters(items: InterventionItem[]): InterventionItem[] {
    const exactEchec = this.isExactEchecFilterActive();
    const strictRacpav = this.isStrictRacpavFilterActive();
    const strictSav = this.isStrictSavFilterActive();
    if (!exactEchec && !strictRacpav && !strictSav) return items;
    return items.filter((item) => {
      if (exactEchec && !this.isExactEchecStatus(item.statut)) return false;
      if (strictRacpav) {
        const status = this.normalizeToken(item.statut);
        const isEchecTermine = status.includes('ECHEC') && status.includes('TERMINE');
        const isExactEchec = status.includes('ECHEC') && !status.includes('TERMINE');
        const isCancelled = status.includes('ANNULE');
        const isPavillon = this.isPavillonHousing(item.typeLogement);
        const isRacpavRelated = this.isRacpavType(item.type) || hasRacpavInArticles(item.articlesRaw);
        const isFailureOrCancel = isPavillon && isRacpavRelated && (isExactEchec || isEchecTermine || isCancelled);
        if (!hasRacpavInArticles(item.articlesRaw) && !isFailureOrCancel) return false;
      }
      if (strictSav && !this.isExactSavItem(item)) return false;
      return true;
    });
  }

  private isExactSavItem(item: InterventionItem): boolean {
    const typeNormalized = this.normalizeToken(item.type);
    return typeNormalized === 'SAV';
  }

  private hasExactSavCode(value?: string | null): boolean {
    if (!value) return false;
    return this.extractCodeTokens(value).includes('SAV');
  }

  private isPrestaComplItem(item: InterventionItem): boolean {
    const typeNormalized = this.normalizeToken(item.type).replace(/-/g, ' ').trim();
    if (typeNormalized === 'PRESTA COMPL') return true;
    return (
      this.hasCode(item.articlesRaw, 'PRESTA_COMPL')
      || this.hasCode(item.articlesRaw, 'PRESTA_COMP')
      || this.hasCode(item.listePrestationsRaw, 'PRESTA_COMPL')
      || this.hasCode(item.listePrestationsRaw, 'PRESTA_COMP')
    );
  }

  private countClosedByType(type: string): number {
    const items = this.statsDataset();
    if (!items.length) return 0;
    return items.reduce((acc, item) => {
      const matches = this.resolveSuccessPrestations(item);
      return matches.includes(type) ? acc + 1 : acc;
    }, 0);
  }

  private rateForType(type: string, rates: InterventionRates): number {
    const map: Record<string, number> = {
      RACPAV: rates.racPavillon.total,
      RACIH: rates.racImmeuble.total,
      RECOIP: rates.reconnexion.total,
      RACPRO_S: rates.racProS.total,
      RACPRO_C: rates.racProC.total,
      REPFOU_PRI: rates.racF8.total,
      PRESTA_COMPL: rates.prestaCompl.total,
      DEPLPRISE: rates.deprise.total,
      DEMO: rates.demo.total,
      SAV: rates.sav.total,
      SAV_EXP: rates.savExp.total,
      REFRAC: rates.refrac.total,
      REFC_DGR: rates.refcDgr.total,
      CLEM: rates.clem.total,
      CABLE_PAV_1: rates.cablePav1.total,
      CABLE_PAV_2: rates.cablePav2.total,
      CABLE_PAV_3: rates.cablePav3.total,
      CABLE_PAV_4: rates.cablePav4.total
    };
    return map[type] ?? 0;
  }

  private logAmountBreakdown(rates: InterventionRates): void {
    const totals = this.summaryTotals();
    if (!totals) return;
    const rows: Array<{ key: string; qty: number; unit: number; total: number }> = [];
    const push = (key: string, qty: number | undefined, unit: number) => {
      const count = Number(qty || 0);
      if (!count) return;
      rows.push({ key, qty: count, unit, total: Math.round(count * unit * 100) / 100 });
    };

    push('RACPAV', totals.racPavillon, rates.racPavillon.total);
    push('CLEM', totals.clem, rates.clem.total);
    push('RECOIP', totals.reconnexion, rates.reconnexion.total);
    push('RACIH', totals.racImmeuble, rates.racImmeuble.total);
    push('RACPRO_S', totals.racProS, rates.racProS.total);
    push('RACPRO_C', totals.racProC, rates.racProC.total);
    push('REPFOU_PRI', totals.racF8, rates.racF8.total);
    push('PRESTA_COMPL', totals.prestaCompl, rates.prestaCompl.total);
    push('DEPLPRISE', totals.deprise, rates.deprise.total);
    push('DEMO', totals.demo, rates.demo.total);
    push('SAV', totals.sav, rates.sav.total);
    push('SAV_EXP', totals.savExp, rates.savExp.total);
    push('REFRAC', totals.refrac, rates.refrac.total);
    push('REFC_DGR', totals.refcDgr, rates.refcDgr.total);
    push('CABLE_PAV_1', totals.cablePav1, rates.cablePav1.total);
    push('CABLE_PAV_2', totals.cablePav2, rates.cablePav2.total);
    push('CABLE_PAV_3', totals.cablePav3, rates.cablePav3.total);
    push('CABLE_PAV_4', totals.cablePav4, rates.cablePav4.total);

    if (!rows.length) return;
    const sum = rows.reduce((acc, row) => acc + row.total, 0);
    console.groupCollapsed('[FXN] Montant total - détail prestations');
    console.table(rows);
    console.log('Total:', Math.round(sum * 100) / 100);
    console.groupEnd();
  }

  private computeStats(items: InterventionItem[], totalCount: number, filterType?: string): TechnicianInterventionStats {
    const total = Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : items.length;
    if (!items.length) return { ...EMPTY_STATS, total };
    const allowedType = this.normalizeFilterType(filterType);
    const allowedTypeLabel = allowedType ? this.normalizeTypeLabel(allowedType) : '';
    const enforcedTypeLabels = allowedType ? [allowedType] : REQUIRED_TYPE_LABELS;
    let success = 0;
    let failure = 0;
    let cancelled = 0;
    let durationSum = 0;
    let durationCount = 0;
    let failureDurationSum = 0;
    let failureDurationCount = 0;
    const technicians = new Map<string, { success: number; failure: number; cancelled: number }>();
    const types = new Map<string, number>();
    const statuses = new Map<string, number>();
    const articleTypeCounts = new Map<string, number>(
      ARTICLE_TYPE_LABELS.map(({ label }) => [label, 0])
    );

    const missingTypeRows: Array<{
      numInter?: string;
      statut?: string;
      type?: string;
      articlesRaw?: string;
      listePrestationsRaw?: string;
      typeOperation?: string;
      commentairesTechnicien?: string;
    }> = [];
    const dominantDebugRows: Array<{
      numInter?: string;
      statut?: string;
      type?: string;
      typeOperation?: string;
      typeLogement?: string;
      marque?: string;
      articlesRaw?: string;
      commentairesTechnicien?: string;
      dominantTypes?: string;
      dominantInArticles?: boolean;
    }> = [];

    for (const item of items) {
      const statutRaw = item.statut ?? '';
      const statut = statutRaw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const isCancelledStatus = statut.includes('annul');
      const isEchecTermine = statut.includes('echec') && statut.includes('termine');
      const isExactEchec = statut.includes('echec') && !statut.includes('termine');
      const isFailureStatus = isEchecTermine || statut.includes('echec') || statut.includes('fail');
      const isClosed = this.isClosedTerminated(statutRaw);
      let isCancelled = isCancelledStatus;
      let isFailure = isFailureStatus;
      let isSuccess = isClosed && !isFailure && !isCancelled && !isEchecTermine;

      if (allowedType === 'RACPAV') {
        const isPavillon = this.isPavillonHousing(item.typeLogement);
        isFailure = isPavillon && (isExactEchec || isEchecTermine);
        isCancelled = isPavillon && isCancelledStatus;
        isSuccess = isRacpavSuccess(item.statut, item.articlesRaw);
      }
      if (isFailure) {
        failure++;
      } else if (isCancelled) {
        cancelled++;
      } else if (isSuccess) {
        success++;
      }
      const dominantTypes = this.resolveDominantTypes(item);
      const dominantInArticles = dominantTypes.length
        ? dominantTypes.every((code) => this.hasCode(item.articlesRaw, code))
        : false;
      const typeLabel = this.canonicalType(item.type, item);
      const matchesAllowedType = !allowedType
        || dominantTypes.includes(allowedType)
        || this.matchesAllowedType(typeLabel, allowedType);
      const includeInTop = isClosed || isFailure || isCancelled;
      if (matchesAllowedType && includeInTop) {
        const techLabel = this.formatTechnicianName(item);
        const techStats = technicians.get(techLabel) ?? { success: 0, failure: 0, cancelled: 0 };
        if (isCancelled) {
          techStats.cancelled = (techStats.cancelled || 0) + 1;
        } else if (isFailure) {
          techStats.failure = (techStats.failure || 0) + 1;
        } else if (isSuccess) {
          techStats.success = (techStats.success || 0) + 1;
        }
        technicians.set(techLabel, techStats);
      }
      const isCompleted = statut.includes('termine') || statut.includes('cloture') || isEchecTermine;
      const value = isCompleted ? this.computeDuration(item) : 0;
      if (Number.isFinite(value) && value > 0 && !isCancelled && !isFailure) {
        durationSum += value;
        durationCount++;
      }
      const failureValue = isFailure ? this.computeFailureDuration(item) : 0;
      if (Number.isFinite(failureValue) && failureValue > 0 && !isCancelled) {
        failureDurationSum += failureValue;
        failureDurationCount++;
      }
      if (isClosed) {
        dominantDebugRows.push({
          numInter: item.numInter,
          statut: item.statut,
          type: item.type,
          typeOperation: item.typeOperation,
          typeLogement: item.typeLogement,
          marque: item.marque,
          articlesRaw: item.articlesRaw,
          commentairesTechnicien: item.commentairesTechnicien,
          dominantTypes: dominantTypes.join(','),
          dominantInArticles
        });
        if (allowedType) {
          if (dominantTypes.includes(allowedType)) {
            types.set(allowedType, (types.get(allowedType) ?? 0) + 1);
          }
        } else if (dominantTypes.length) {
          for (const label of dominantTypes) {
            types.set(label, (types.get(label) ?? 0) + 1);
          }
        } else {
          const typeLabel = this.canonicalType(item.type, item);
          types.set(typeLabel, (types.get(typeLabel) ?? 0) + 1);
          if (typeLabel === '—' || typeLabel === 'OTHER' || !typeLabel) {
            missingTypeRows.push({
              numInter: item.numInter,
              statut: item.statut,
              type: item.type,
              articlesRaw: item.articlesRaw,
              listePrestationsRaw: item.listePrestationsRaw,
              typeOperation: item.typeOperation,
              commentairesTechnicien: item.commentairesTechnicien
            });
          }
        }
      }
      const rawStatusLabel = item.statut?.trim() || 'Autre';
      const normalizedStatus = this.normalizeToken(rawStatusLabel);
      let statusLabel = rawStatusLabel;
      if (normalizedStatus.includes('ECHEC') && normalizedStatus.includes('TERMINE')) {
        statusLabel = 'ECHEC TERMINE';
      } else if (normalizedStatus.includes('ECHEC')) {
        statusLabel = 'ECHEC';
      } else if (normalizedStatus.includes('ANNULEE') || normalizedStatus.includes('ANNULE')) {
        statusLabel = 'ANNULEE';
      }
      if (!allowedType) {
        statuses.set(statusLabel, (statuses.get(statusLabel) ?? 0) + 1);
      } else {
        const typeLabel = this.canonicalType(item.type, item);
        const matchesAllowedType = dominantTypes.includes(allowedType) || this.matchesAllowedType(typeLabel, allowedType);
        if ((isClosed && matchesAllowedType) || (isCancelled && matchesAllowedType) || (isFailure && matchesAllowedType)) {
          statuses.set(statusLabel, (statuses.get(statusLabel) ?? 0) + 1);
        }
      }
      if (isClosed) {
        const articleLabels = new Set<string>();
        for (const code of dominantTypes) {
          const label = ARTICLE_TYPE_BY_CODE.get(code);
          if (!label) continue;
          if (allowedType && !this.isAllowedArticleLabel(label, allowedTypeLabel)) {
            continue;
          }
          articleTypeCounts.set(label, (articleTypeCounts.get(label) ?? 0) + 1);
          articleLabels.add(label);
        }
        if (!articleLabels.size) {
          const typeLabel = this.canonicalType(item.type, item);
          const label = ARTICLE_TYPE_BY_CODE.get(typeLabel);
          if (label && (!allowedType || this.isAllowedArticleLabel(label, allowedTypeLabel))) {
            articleTypeCounts.set(label, (articleTypeCounts.get(label) ?? 0) + 1);
          }
        }
      }
    }

    const topTechnicians = Array.from(technicians.entries())
      .map(([label, stats]) => ({
        label,
        success: stats.success,
        failure: stats.failure,
        cancelled: stats.cancelled,
        ratio: (stats.failure + stats.cancelled) === 0
          ? (stats.success === 0 ? 0 : Infinity)
          : stats.success / (stats.failure + stats.cancelled)
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 3)
      .map(({ label, success, failure, cancelled }) => ({ label, success, failure, cancelled }));
    const baseTopTypes = Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
    const displayBaseTopTypes = baseTopTypes.map((type) => ({
      label: this.normalizeTypeLabel(type.label),
      count: type.count
    }));
    const baseTypeLabels = new Set(displayBaseTopTypes.map((type) => type.label));
    const enforcedTypes = enforcedTypeLabels
      .filter((label) => !baseTopTypes.some((type) => type.label === label))
      .map((label) => ({ label, count: types.get(label) ?? 0 }));
    const articleTypeEntries = ARTICLE_TYPE_LABELS.map(({ label }) => ({
      label,
      count: articleTypeCounts.get(label) ?? 0
    })).filter((entry) => !baseTypeLabels.has(entry.label));
    const enforcedTypeEntries = enforcedTypes
      .map((entry) => ({
        label: this.normalizeTypeLabel(entry.label),
        count: entry.count
      }))
      .filter((entry) => !baseTypeLabels.has(entry.label));
    const topTypes = [...displayBaseTopTypes, ...articleTypeEntries, ...enforcedTypeEntries];
    const uniqueTopTypes: Array<{ label: string; count: number }> = [];
    for (const entry of topTypes) {
      const existing = uniqueTopTypes.find((item) => item.label === entry.label);
      if (existing) {
        existing.count = Math.max(existing.count, entry.count);
      } else {
        uniqueTopTypes.push({ ...entry });
      }
    }
    uniqueTopTypes.sort((a, b) => b.count - a.count);
    const filteredTopTypes = allowedType
      ? uniqueTopTypes
      : uniqueTopTypes.filter((entry) => !this.isRaccType(entry.label) && !this.isPavLabel(entry.label));
    const allowedLabel = allowedType ? this.normalizeTypeLabel(allowedType) : '';
    const normalizedAllowed = this.normalizeToken(allowedType);
    const normalizedAllowedLabel = this.normalizeToken(allowedLabel);
    const finalTopTypes = allowedType
      ? filteredTopTypes.filter((entry) => {
          const normalizedEntry = this.normalizeToken(entry.label);
          return normalizedEntry === normalizedAllowed || normalizedEntry === normalizedAllowedLabel;
        })
      : filteredTopTypes;
    const ALWAYS_STATUSES = ['ECHEC TERMINE', 'ECHEC', 'ANNULEE', 'A COMPLETER'];
    for (const label of ALWAYS_STATUSES) {
      if (!statuses.has(label)) statuses.set(label, 0);
    }
    const topStatuses = Array.from(statuses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
    const mandatoryStatuses = ['CLOTURE TERMINEE', 'ECHEC TERMINE', 'ECHEC', 'ANNULEE', 'A COMPLETER'];
    for (const label of mandatoryStatuses) {
      if (!topStatuses.some((entry) => entry.label === label)) {
        topStatuses.push({ label, count: statuses.get(label) ?? 0 });
      }
    }
    const mandatorySet = new Set(mandatoryStatuses);
    const reorderedTopStatuses = [
      ...mandatoryStatuses
        .map((label) => topStatuses.find((entry) => entry.label === label))
        .filter((entry): entry is { label: string; count: number } => Boolean(entry)),
      ...topStatuses.filter((entry) => !mandatorySet.has(entry.label))
    ];

    const denominator = success + failure;

    if (missingTypeRows.length) {
      console.groupCollapsed('[FXN] Interventions cloture terminee sans type detecte');
      console.table(missingTypeRows);
      console.groupEnd();
    }
    if (dominantDebugRows.length) {
      console.groupCollapsed('[FXN] Debug dominant types (cloture terminee)');
      console.table(dominantDebugRows);
      const highlightRows = dominantDebugRows
        .map((row, index) => ({ row, index }))
        .filter((entry) => entry.row.dominantInArticles);
      if (highlightRows.length) {
        console.groupCollapsed('[FXN] Colonnes en blanc (dominantTypes + articlesRaw)');
        for (const { row, index } of highlightRows) {
          console.log(
            '%c' + `Ligne ${index + 1} | dominantTypes: ${row.dominantTypes ?? ''} | articlesRaw: ${row.articlesRaw ?? ''}`,
            'color:#fff;background:#000;padding:2px 4px;border-radius:2px'
          );
        }
        console.groupEnd();
      }
      console.groupEnd();
    }

    return {
      total,
      success,
      failure,
      avgDuration: durationCount ? Math.round(durationSum / durationCount) : 0,
      avgFailureDuration: failureDurationCount ? Math.round(failureDurationSum / failureDurationCount) : 0,
      successRate: denominator ? Math.round((success / denominator) * 100) : 0,
      topTechnicians,
      topTypes: finalTopTypes,
      topStatuses: reorderedTopStatuses,
      cancelled
    };
  }

  totalAmount(): number {
    const rates = this.ratesService.rates();
    const rawType = this.filterForm.getRawValue().type || '';
    const normalizedType = this.normalizeFilterType(rawType);
    if (normalizedType) {
      const count = this.countClosedByType(normalizedType);
      const rate = this.rateForType(normalizedType, rates);
      return Math.round(count * rate * 100) / 100;
    }
    this.logAmountBreakdown(rates);
    return this.computeTotalAmount(this.summaryTotals(), rates);
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

  private computeTotalAmount(totals: InterventionTotals | null, rates: InterventionRates): number {
    if (!totals) return 0;
    const get = (value?: number) => (Number.isFinite(value as number) ? Number(value) : 0);
    let amount = 0;
    amount += get(totals.racPavillon) * rates.racPavillon.total;
    amount += get(totals.clem) * rates.clem.total;
    amount += get(totals.reconnexion) * rates.reconnexion.total;
    amount += get(totals.racImmeuble) * rates.racImmeuble.total;
    amount += get(totals.racProS) * rates.racProS.total;
    amount += get(totals.racProC) * rates.racProC.total;
    amount += get(totals.racF8) * rates.racF8.total;
    amount += get(totals.prestaCompl) * rates.prestaCompl.total;
    amount += get(totals.deprise) * rates.deprise.total;
    amount += get(totals.demo) * rates.demo.total;
    amount += get(totals.sav) * rates.sav.total;
    amount += get(totals.savExp) * rates.savExp.total;
    amount += get(totals.refrac) * rates.refrac.total;
    amount += get(totals.refcDgr) * rates.refcDgr.total;
    return Math.round(amount * 100) / 100;
  }

  private computeDuration(item: InterventionItem): number {
    const start = item.debutIntervention || item.debut;
    const end = item.clotureHotline || item.clotureTech;
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return 0;
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
  }

  private computeFailureDuration(item: InterventionItem): number {
    const start = item.debutIntervention || item.debut;
    const end = item.clotureTech;
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return 0;
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
  }

  formatDuration(item: InterventionItem): string {
    const minutes = this.computeDuration(item);
    if (minutes <= 0) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (remainder === 0) return `${hours} h`;
    return `${hours} h ${remainder} min`;
  }

  private updateStatsDataset(items: InterventionItem[], totalCount: number, lastQuery: InterventionSummaryQuery): void {
    const safeTotal = Number.isFinite(totalCount) ? totalCount : items.length;
    if (!safeTotal) {
      this.statsDataset.set([]);
      return;
    }
    const limitUsed = lastQuery.limit ?? this.limit();
    if (safeTotal <= limitUsed) {
      this.statsDataset.set(this.applyStrictStatsFilters(items));
      return;
    }
    const statsQuery = this.buildQuery({ includePagination: false });
    statsQuery.page = 1;
    statsQuery.limit = safeTotal;
    this.svc.list(statsQuery).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.statsDataset.set(this.applyStrictStatsFilters(items));
          return;
        }
        const incoming = res.data.items || items;
        this.statsDataset.set(this.applyStrictStatsFilters(incoming));
      },
      error: () => {
        this.statsDataset.set(this.applyStrictStatsFilters(items));
      }
    });
  }

  private sortedItems(): InterventionItem[] {
    const items = [...this.interventions()];
    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    const compare = (a: any, b: any): number => {
      if (a === b) return 0;
      if (a === null || a === undefined) return -1;
      if (b === null || b === undefined) return 1;
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    };

    return items.sort((a, b) => {
      switch (field) {
        case 'date': {
          const dateA = new Date(a.dateRdv || a.debut || '');
          const dateB = new Date(b.dateRdv || b.debut || '');
          const diff = dateA.getTime() - dateB.getTime();
          return direction * (Number.isFinite(diff) ? diff : 0);
        }
        case 'type':
          return direction * compare(a.type, b.type);
        case 'statut':
          return direction * compare(a.statut, b.statut);
        case 'duree': {
          const durationA = this.computeDuration(a);
          const durationB = this.computeDuration(b);
          const cancelledA = this.isCancelledStatus(a.statut);
          const cancelledB = this.isCancelledStatus(b.statut);
          const valueA = cancelledA ? Number.POSITIVE_INFINITY : durationA;
          const valueB = cancelledB ? Number.POSITIVE_INFINITY : durationB;
          return direction * (valueA - valueB);
        }
      }
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  applyView(view: 'topTech' | 'failures' | 'reconnections'): void {
    if (view === 'failures') {
      this.filterForm.controls.status.setValue(this.chooseFailureStatus());
      this.filterForm.controls.type.setValue('');
      this.sortField.set('duree');
      this.sortDirection.set('desc');
    } else if (view === 'reconnections') {
      this.filterForm.controls.status.setValue('');
      this.filterForm.controls.type.setValue(this.chooseReconnectionType());
    }
    if (view === 'topTech') {
      this.sortField.set('duree');
      this.sortDirection.set('desc');
    }
    this.page.set(1);
    this.loadInterventions();
  }

  private chooseFailureStatus(): string {
    const statuses = this.filters()?.statuses ?? [];
    const preferred = statuses.find((status) => this.isFailureTerminated(status));
    return preferred ?? 'Échec terminée';
  }

  private chooseClosedStatus(): string {
    const statuses = this.filters()?.statuses ?? [];
    const closed = statuses.find((status) => this.isClosedTerminated(status));
    return closed ?? 'Clôture terminée';
  }

  private chooseReconnectionType(): string {
    const types = this.filters()?.types ?? [];
    const candidate = types.find((type) => this.isReconnectionType(type));
    return candidate ?? 'RECO';
  }

  private isFailureTerminated(status?: string): boolean {
    if (!status) return false;
    const normalized = this.normalizeToken(status);
    return normalized.includes('ECHEC') && normalized.includes('TERMINE');
  }

  private isClosedTerminated(status?: string): boolean {
    if (!status) return false;
    const normalized = this.normalizeToken(status);
    return normalized.includes('CLOTURE') && normalized.includes('TERMINE');
  }

  private isReconnectionType(type?: string): boolean {
    if (!type) return false;
    const normalized = this.normalizeToken(type);
    return normalized.includes('RECO');
  }

  private isCancelledStatus(status?: string): boolean {
    if (!status) return false;
    return status.toLowerCase().includes('annul');
  }

  private extractCodeTokens(value?: string | null): string[] {
    if (!value) return [];
    return String(value)
      .split(/[,;+]/)
      .map((entry) => entry.replace(/"/g, '').trim())
      .filter(Boolean)
      .map((entry) => entry.replace(/\s+x?\d+$/i, '').trim())
      .map((entry) => entry.replace(/\s+/g, '_'))
      .map((entry) => entry.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase())
      .filter(Boolean);
  }

  private hasCode(value: string | null | undefined, code: string): boolean {
    if (!value) return false;
    const target = code.toUpperCase();
    return this.extractCodeTokens(value).some((token) => token === target);
  }

  private canonicalType(value?: string, item?: InterventionItem): string {
    const raw = (value ?? '').trim();
    const normalizedType = this.normalizeToken(raw).replace(/-/g, ' ');
    const normalizedTypeCollapsed = normalizedType.replace(/\s+/g, ' ').trim();
    const articlesNormalized = this.normalizeToken(item?.articlesRaw);
    const prestationsNormalized = this.normalizeToken(item?.listePrestationsRaw);
    const statusNormalized = this.normalizeToken(item?.statut);
    const commentsNormalized = this.normalizeToken(item?.commentairesTechnicien);
    if (isRacpavSuccess(item?.statut, item?.articlesRaw)) {
      return 'RACPAV';
    }
    if (isRacihSuccess(item?.statut, item?.articlesRaw)) {
      return 'RACIH';
    }
    if (
      statusNormalized.includes('CLOTURE')
      && statusNormalized.includes('TERMINEE')
      && (articlesNormalized.includes('RECOIP') || normalizedType === 'RECO')
    ) {
      return 'RECOIP';
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      return 'RACPRO_S';
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      return 'RACPRO_C';
    }
    if (
      this.hasCode(item?.articlesRaw, 'SAV')
      || this.hasCode(item?.listePrestationsRaw, 'SAV')
      || normalizedTypeCollapsed === 'SAV'
    ) {
      return 'SAV';
    }
    if (
      (normalizedType.includes('PRESTA') && normalizedType.includes('COMPL'))
      || articlesNormalized.includes('PRESTA_COMPL')
    ) {
      return 'PRESTA_COMPL';
    }
    if (
      articlesNormalized.includes('REPFOU_PRI')
      || commentsNormalized.includes('F8')
      || prestationsNormalized.includes('FOURREAUX')
      || prestationsNormalized.includes('DOMAINE')
    ) {
      return 'REPFOU_PRI';
    }
    if (normalizedTypeCollapsed === 'REFC_DGR' || statusNormalized.includes('REFC_DGR')) {
      return 'REFC_DGR';
    }
    if (normalizedTypeCollapsed === 'DEPLPRISE' || articlesNormalized.includes('DEPLPRISE')) {
      return 'DEPLPRISE';
    }
    if (normalizedTypeCollapsed === 'REFRAC' || articlesNormalized.includes('REFRAC')) {
      return 'REFRAC';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 1')
      || normalizedTypeCollapsed.includes('CABLE_PAV_1')
      || articlesNormalized.includes('CABLE_PAV_1')
      || articlesNormalized.includes('CABLE PAV 1')
      || prestationsNormalized.includes('CABLE_PAV_1')
      || prestationsNormalized.includes('CABLE PAV 1')
    ) {
      return 'CABLE_PAV_1';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 2')
      || normalizedTypeCollapsed.includes('CABLE_PAV_2')
      || articlesNormalized.includes('CABLE_PAV_2')
      || articlesNormalized.includes('CABLE PAV 2')
      || prestationsNormalized.includes('CABLE_PAV_2')
      || prestationsNormalized.includes('CABLE PAV 2')
    ) {
      return 'CABLE_PAV_2';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 3')
      || normalizedTypeCollapsed.includes('CABLE_PAV_3')
      || articlesNormalized.includes('CABLE_PAV_3')
      || articlesNormalized.includes('CABLE PAV 3')
      || prestationsNormalized.includes('CABLE_PAV_3')
      || prestationsNormalized.includes('CABLE PAV 3')
    ) {
      return 'CABLE_PAV_3';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 4')
      || normalizedTypeCollapsed.includes('CABLE_PAV_4')
      || articlesNormalized.includes('CABLE_PAV_4')
      || articlesNormalized.includes('CABLE PAV 4')
      || prestationsNormalized.includes('CABLE_PAV_4')
      || prestationsNormalized.includes('CABLE PAV 4')
    ) {
      return 'CABLE_PAV_4';
    }
    if (!raw) return 'Autre';
    if (normalizedTypeCollapsed === 'RACIH') {
      return 'RACIH';
    }
    return TYPE_CANONICAL_ALIASES.get(normalizedTypeCollapsed) ?? raw;
  }

  private resolveDominantTypes(item: InterventionItem): string[] {
    if (!this.isClosedTerminated(item.statut)) return [];
    const types: string[] = [];
    const statusNormalized = this.normalizeToken(item.statut);
    const typeNormalized = this.normalizeToken(item.type).replace(/-/g, ' ').trim();
    const typeOperationNormalized = this.normalizeToken(item.typeOperation);
    const logementNormalized = this.normalizeToken(item.typeLogement);
    const marqueNormalized = this.normalizeToken(item.marque);
    const commentsNormalized = this.normalizeToken(item.commentairesTechnicien);

    if (isRacpavSuccess(item.statut, item.articlesRaw)) {
      types.push('RACPAV');
    }
    if (isRacihSuccess(item.statut, item.articlesRaw)) {
      if (!types.includes('RACIH')) {
        types.push('RACIH');
      }
    }
    if (this.hasCode(item.articlesRaw, 'RECOIP') || typeNormalized === 'RECO') {
      types.push('RECOIP');
    }
    if (statusNormalized.includes('RACPRO_S') || marqueNormalized.includes('B2B')) {
      types.push('RACPRO_S');
    }
    if (this.hasCode(item.articlesRaw, 'RACPRO_C')) {
      types.push('RACPRO_C');
    }
    if (this.hasCode(item.articlesRaw, 'SAV') || typeNormalized === 'SAV') {
      types.push('SAV');
    }
    if (this.hasCode(item.articlesRaw, 'CLEM')) {
      types.push('CLEM');
    }
    if (typeNormalized === 'PRESTA COMPL' || this.hasCode(item.articlesRaw, 'PRESTA_COMP') || this.hasCode(item.articlesRaw, 'PRESTA_COMPL')) {
      types.push('PRESTA_COMPL');
    }
    if (this.hasCode(item.articlesRaw, 'REPFOU_PRI') || commentsNormalized.includes('F8')) {
      types.push('REPFOU_PRI');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_1')) {
      types.push('CABLE_PAV_1');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_2')) {
      types.push('CABLE_PAV_2');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_3')) {
      types.push('CABLE_PAV_3');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_4')) {
      types.push('CABLE_PAV_4');
    }
    return types;
  }

  private normalizeFilterType(value?: string): string {
    const normalized = this.normalizeToken(value).replace(/[^A-Z0-9_]/g, '');
    if (!normalized) return '';
    const aliases = new Map([
      ['RACPAV', 'RACPAV'],
      ['RACIH', 'RACIH'],
      ['RECOIP', 'RECOIP'],
      ['RECO', 'RECOIP'],
      ['RACPROS', 'RACPRO_S'],
      ['RACPRO_S', 'RACPRO_S'],
      ['RACPROC', 'RACPRO_C'],
      ['RACPRO_C', 'RACPRO_C'],
      ['CLEM', 'CLEM'],
      ['SAV', 'SAV'],
      ['PRESTACOMPL', 'PRESTA_COMPL'],
      ['PRESTA_COMPL', 'PRESTA_COMPL'],
      ['PRESTAF8', 'REPFOU_PRI'],
      ['REPFOU_PRI', 'REPFOU_PRI'],
      ['REFC_DGR', 'REFC_DGR'],
      ['REFCDGR', 'REFC_DGR'],
      ['DEPLPRISE', 'DEPLPRISE'],
      ['REFRAC', 'REFRAC'],
      ['CABLE_PAV_1', 'CABLE_PAV_1'],
      ['CABLE_PAV_2', 'CABLE_PAV_2'],
      ['CABLE_PAV_3', 'CABLE_PAV_3'],
      ['CABLE_PAV_4', 'CABLE_PAV_4'],
      ['CABLEPAV1', 'CABLE_PAV_1'],
      ['CABLEPAV2', 'CABLE_PAV_2'],
      ['CABLEPAV3', 'CABLE_PAV_3'],
      ['CABLEPAV4', 'CABLE_PAV_4']
    ]);
    return aliases.get(normalized) ?? '';
  }

  private normalizeTypeLabel(label: string): string {
    const normalized = this.normalizeToken(label);
    if (normalized === 'RACPAV') return 'RACPAV';
    if (normalized === 'RECOIP') return 'RECO';
    if (normalized === 'RACPRO_S') return 'PRO S';
    if (normalized === 'RACPRO_C') return 'PRO C';
    if (normalized === 'REPFOU_PRI') return 'PRESTA F8';
    if (normalized === 'IMM' || normalized === 'RACIH') return 'RACIH';
    if (normalized === 'CABLE_PAV_1') return 'CABLE PAV 1';
    if (normalized === 'CABLE_PAV_2') return 'CABLE PAV 2';
    if (normalized === 'CABLE_PAV_3') return 'CABLE PAV 3';
    if (normalized === 'CABLE_PAV_4') return 'CABLE PAV 4';
    return label;
  }

  private isRaccType(label: string): boolean {
    const normalized = this.normalizeToken(label);
    return normalized.includes('RACC');
  }

  private isPavLabel(label: string): boolean {
    const normalized = this.normalizeToken(label);
    return normalized === 'PAV';
  }

  private matchesAllowedType(typeLabel: string, allowedType: string): boolean {
    if (!allowedType) return true;
    const normalizedType = this.normalizeToken(typeLabel);
    const normalizedAllowed = this.normalizeToken(allowedType);
    if (normalizedAllowed === 'RACIH' && normalizedType === 'IMM') return true;
    if (normalizedAllowed === 'RACPAV' && (normalizedType === 'RACC' || normalizedType === 'RACPAV')) return true;
    return normalizedType === normalizedAllowed;
  }

  private isAllowedArticleLabel(label: string, allowedLabel: string): boolean {
    if (!allowedLabel) return true;
    return this.normalizeToken(label) === this.normalizeToken(allowedLabel);
  }

  private computeFailurePercent(stats: TechnicianInterventionStats): number {
    const denominator = stats.success + stats.failure;
    if (!denominator) return 0;
    return Math.round((stats.failure / denominator) * 100);
  }

  private computeSuccessRateBg(rate: number): string {
    const clamped = Math.max(0, Math.min(100, rate));
    const step = 4;
    const quantized = Math.min(100, Math.max(0, Math.round(clamped / step) * step));
    const t = quantized / 100;
    const start = { r: 239, g: 68, b: 68 };
    const end = { r: 46, g: 140, b: 108 };
    const lerp = (startValue: number, endValue: number) =>
      Math.round(startValue + (endValue - startValue) * t);
    return `rgb(${lerp(start.r, end.r)}, ${lerp(start.g, end.g)}, ${lerp(start.b, end.b)})`;
  }

  private countMatchingType(target: string): number {
    if (!target) return 0;
    const normalizedTarget = target.toLowerCase();
    return this.statsDataset().reduce((acc, item) => {
      const typeLabel = this.canonicalType(item.type, item).toLowerCase();
      return typeLabel === normalizedTarget ? acc + 1 : acc;
    }, 0);
  }

  statusClass(item: InterventionItem): string {
    const stat = (item.statut ?? '').toLowerCase();
    if (stat.includes('echec') || stat.includes('fail')) return 'status-error';
    if (stat.includes('termine') || stat.includes('complet') || stat.includes('ok')) return 'status-success';
    return 'status-neutral';
  }

  formatTechnicianName(item: InterventionItem): string {
    const formatted = formatPersonName(item.techFirstName ?? '', item.techLastName ?? '');
    return formatted || '–';
  }

  openDetails(item: InterventionItem): void {
    this.selectedDetail.set(item);
    this.detailOpen.set(true);
  }

  closeDetails(): void {
    this.detailOpen.set(false);
    this.selectedDetail.set(null);
  }

  detailEntries(): Array<{ label: string; value: string }> {
    const item = this.selectedDetail();
    if (!item) return [];
    return this.detailFields.map((field) => ({
      label: field.label,
      value: this.formatDetailValueByKey(field.key, item[field.key])
    }));
  }

  private formatDetailValueByKey(key: keyof InterventionItem, value: unknown): string {
    if (key === 'listePrestationsRaw') {
      return this.formatPrestationsRaw(value);
    }
    return this.formatDetailValue(value);
  }

  private formatDetailValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    return String(value);
  }

  private formatPrestationsRaw(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const raw = String(value);
    const parts = raw
      .split(/[,;+]/)
      .map((entry) => entry.replace(/"/g, '').trim())
      .filter(Boolean)
      .map((entry) => entry.split(/\s+/)[0])
      .map((entry) => entry.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase())
      .filter(Boolean)
      .filter((code) => code !== 'SAV_EXP');

    if (!parts.length) return '—';
    const seen = new Set<string>();
    const unique = [];
    for (const code of parts) {
      if (seen.has(code)) continue;
      seen.add(code);
      unique.push(code);
    }
    return unique.join(', ');
  }

  technicianLabel(tech: User): string {
    return this.formatTechnicianName({ techFirstName: tech.firstName, techLastName: tech.lastName } as any);
  }

  topStatusCount(keyword: string): number {
    const label = keyword.toLowerCase();
    const entry = this.stats()
      ?.topStatuses.find((s) => s.label?.toLowerCase().includes(label));
    return entry?.count ?? this.stats().failure;
  }

  topStatusSummary(): string {
    const labels = this.stats()
      .topStatuses.map((s) => s.label)
      .filter(Boolean);
    return labels.length ? labels.join(', ') : '—';
  }

  frequentStatusClass(label?: string): string {
    const normalized = this.normalizeToken(label);
    if (normalized.includes('CLOTURE') && normalized.includes('TERMINEE')) {
      return 'status-success';
    }
    if (normalized.includes('ANNULE')) {
      return 'status-neutral';
    }
    if (normalized.includes('ECHEC')) {
      return 'status-error';
    }
    return '';
  }

  private apiError(err: any, fallback: string): string {
    if (typeof err?.error === 'object' && err.error !== null && 'message' in err.error) {
      return String(err.error.message ?? fallback);
    }
    return err?.message || fallback;
  }

  private normalizeToken(value?: string | null): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private resolveSuccessPrestations(item: InterventionItem): string[] {
    if (!this.isClosedTerminated(item.statut)) return [];
    const typeNormalized = this.normalizeToken(item.type).replace(/-/g, ' ').trim();
    const articlesNormalized = this.normalizeToken(item.articlesRaw);
    const statusNormalized = this.normalizeToken(item.statut);
    const commentsNormalized = this.normalizeToken(item.commentairesTechnicien);
    const prestationsNormalized = this.normalizeToken(item.listePrestationsRaw);
    const matches: string[] = [];

    if (isRacpavSuccess(item.statut, item.articlesRaw)) matches.push('RACPAV');
    if (isRacihSuccess(item.statut, item.articlesRaw)) {
      matches.push('RACIH');
    }
    if (
      articlesNormalized.includes('RECOIP')
      || typeNormalized === 'RECO'
    ) {
      matches.push('RECOIP');
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      matches.push('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      matches.push('RACPRO_C');
    }
    if (this.hasCode(item.articlesRaw, 'CLEM')) {
      matches.push('CLEM');
    }
    if (
      typeNormalized.includes('CABLE_PAV_1')
      || typeNormalized.includes('CABLE PAV 1')
      || articlesNormalized.includes('CABLE_PAV_1')
      || articlesNormalized.includes('CABLE PAV 1')
    ) {
      matches.push('CABLE_PAV_1');
    }
    if (
      typeNormalized.includes('CABLE_PAV_2')
      || typeNormalized.includes('CABLE PAV 2')
      || articlesNormalized.includes('CABLE_PAV_2')
      || articlesNormalized.includes('CABLE PAV 2')
    ) {
      matches.push('CABLE_PAV_2');
    }
    if (
      typeNormalized.includes('CABLE_PAV_3')
      || typeNormalized.includes('CABLE PAV 3')
      || articlesNormalized.includes('CABLE_PAV_3')
      || articlesNormalized.includes('CABLE PAV 3')
    ) {
      matches.push('CABLE_PAV_3');
    }
    if (
      typeNormalized.includes('CABLE_PAV_4')
      || typeNormalized.includes('CABLE PAV 4')
      || articlesNormalized.includes('CABLE_PAV_4')
      || articlesNormalized.includes('CABLE PAV 4')
    ) {
      matches.push('CABLE_PAV_4');
    }
    if (
      this.hasCode(item?.articlesRaw, 'SAV')
      || this.hasCode(item?.listePrestationsRaw, 'SAV')
      || typeNormalized === 'SAV'
    ) {
      matches.push('SAV');
    }
    if (
      (typeNormalized.includes('PRESTA') && typeNormalized.includes('COMPL'))
      || articlesNormalized.includes('PRESTA_COMPL')
    ) {
      matches.push('PRESTA_COMPL');
    }
    if (
      articlesNormalized.includes('REPFOU_PRI')
      || commentsNormalized.includes('F8')
      || prestationsNormalized.includes('FOURREAUX')
      || prestationsNormalized.includes('DOMAINE')
    ) {
      matches.push('REPFOU_PRI');
    }
    if (typeNormalized === 'REFC_DGR' || statusNormalized.includes('REFC_DGR')) {
      matches.push('REFC_DGR');
    }
    if (typeNormalized === 'DEPLPRISE' || articlesNormalized.includes('DEPLPRISE')) {
      matches.push('DEPLPRISE');
    }
    if (typeNormalized === 'REFRAC' || articlesNormalized.includes('REFRAC')) {
      matches.push('REFRAC');
    }

    return matches;
  }
}
