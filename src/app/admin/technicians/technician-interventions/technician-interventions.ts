import { CommonModule } from '@angular/common';
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
import { formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

type TechnicianInterventionStats = {
  total: number;
  success: number;
  failure: number;
  avgDuration: number;
  avgFailureDuration: number;
  successRate: number;
  topTechnicians: Array<{ label: string; success: number; failure: number }>;
  topTypes: Array<{ label: string; count: number }>;
  topStatuses: Array<{ label: string; count: number }>;
};

const EMPTY_STATS: TechnicianInterventionStats = {
  total: 0,
  success: 0,
  failure: 0,
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
  imports: [CommonModule, ReactiveFormsModule],
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
  constructor() {
    this.loadFilters();
    this.loadTechnicians();
    this.loadInterventions();
    this.loadSummary();
    this.ratesService.refresh().subscribe();
  }

  applyFilters(): void {
    this.page.set(1);
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
    const extra = ['CABLE_PAV_1', 'CABLE_PAV_2', 'CABLE_PAV_3', 'CABLE_PAV_4', 'CLEM', 'VIDE'];
    const types = Array.isArray(filters?.types) ? [...filters.types] : [];
    for (const entry of extra) {
      if (!types.includes(entry)) {
        types.push(entry);
      }
    }
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
        const total = res.data.total || 0;
        this.interventions.set(items);
        this.total.set(total);
        this.updateStatsDataset(items, total, pagedQuery);
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
    return {
      technician: filters.technician || undefined,
      region: filters.region || undefined,
      client: filters.client || undefined,
      numInter: filters.numInter || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined,
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

  private computeStats(items: InterventionItem[], totalCount: number, filterType?: string): TechnicianInterventionStats {
    const total = Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : items.length;
    if (!items.length) return { ...EMPTY_STATS, total };
    const allowedType = this.normalizeFilterType(filterType);
    const allowedTypeLabel = allowedType ? this.normalizeTypeLabel(allowedType) : '';
    const enforcedTypeLabels = allowedType ? [allowedType] : REQUIRED_TYPE_LABELS;
    let success = 0;
    let failure = 0;
    let durationSum = 0;
    let durationCount = 0;
    let failureDurationSum = 0;
    let failureDurationCount = 0;
    const technicians = new Map<string, { success: number; failure: number }>();
    const types = new Map<string, number>();
    const statuses = new Map<string, number>();
    const articleTypeCounts = new Map<string, number>(
      ARTICLE_TYPE_LABELS.map(({ label }) => [label, 0])
    );

    for (const item of items) {
      const statutRaw = item.statut ?? '';
      const statut = statutRaw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (statut.includes('echec') || statut.includes('fail')) {
        failure++;
      }
      const successMatches = this.resolveSuccessPrestations(item);
      if (successMatches.length) {
        success++;
      }
      const isCancelled = statut.includes('annul');
      const isEchecTermine = statut.includes('echec') && statut.includes('termine');
      const isCompleted = statut.includes('termine') || statut.includes('cloture') || isEchecTermine;
      const isFailure = isEchecTermine;
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
      const matchesAllowedType = !allowedType
        || successMatches.includes(allowedType)
        || this.matchesAllowedType(this.canonicalType(item.type, item), allowedType);
      if (matchesAllowedType) {
        const techLabel = this.formatTechnicianName(item);
        const techStats = technicians.get(techLabel) ?? { success: 0, failure: 0 };
        if (statut.includes('echec') || statut.includes('fail')) {
          techStats.failure = (techStats.failure || 0) + 1;
        } else if (successMatches.length) {
          techStats.success = (techStats.success || 0) + 1;
        }
        technicians.set(techLabel, techStats);
      }
      if (allowedType) {
        if (successMatches.length) {
          if (successMatches.includes(allowedType)) {
            types.set(allowedType, (types.get(allowedType) ?? 0) + 1);
          }
        } else {
          const typeLabel = this.canonicalType(item.type, item);
          if (this.matchesAllowedType(typeLabel, allowedType)) {
            types.set(allowedType, (types.get(allowedType) ?? 0) + 1);
          }
        }
      } else if (successMatches.length) {
        for (const label of successMatches) {
          types.set(label, (types.get(label) ?? 0) + 1);
        }
      } else {
        const typeLabel = this.canonicalType(item.type, item);
        types.set(typeLabel, (types.get(typeLabel) ?? 0) + 1);
      }
      const statusLabel = item.statut?.trim() || 'Autre';
      statuses.set(statusLabel, (statuses.get(statusLabel) ?? 0) + 1);
      const articlesNormalized = this.normalizeToken(item.articlesRaw);
      const prestationsNormalized = this.normalizeToken(item.listePrestationsRaw);
      const articleLabels = new Set<string>();
      for (const { label, marker } of ARTICLE_TYPE_LABELS) {
        const altMarker = marker.replace(/_/g, ' ');
        if (
          articlesNormalized.includes(marker)
          || articlesNormalized.includes(altMarker)
          || prestationsNormalized.includes(marker)
          || prestationsNormalized.includes(altMarker)
        ) {
          if (allowedType && !this.isAllowedArticleLabel(label, allowedTypeLabel)) {
            continue;
          }
          articleTypeCounts.set(label, (articleTypeCounts.get(label) ?? 0) + 1);
          articleLabels.add(label);
        }
      }
      for (const code of successMatches) {
        const label = ARTICLE_TYPE_BY_CODE.get(code);
        if (label && !articleLabels.has(label)) {
          if (allowedType && !this.isAllowedArticleLabel(label, allowedTypeLabel)) {
            continue;
          }
          articleTypeCounts.set(label, (articleTypeCounts.get(label) ?? 0) + 1);
        }
      }
    }

    const topTechnicians = Array.from(technicians.entries())
      .map(([label, stats]) => ({
        label,
        success: stats.success,
        failure: stats.failure,
        ratio: stats.failure === 0 ? (stats.success === 0 ? 0 : Infinity) : stats.success / stats.failure
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 3)
      .map(({ label, success, failure }) => ({ label, success, failure }));
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
    const filteredTopTypes = uniqueTopTypes.filter((entry) => !this.isRaccType(entry.label) && !this.isPavLabel(entry.label));
    const topStatuses = Array.from(statuses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));

    const denominator = success + failure;

    return {
      total,
      success,
      failure,
      avgDuration: durationCount ? Math.round(durationSum / durationCount) : 0,
      avgFailureDuration: failureDurationCount ? Math.round(failureDurationSum / failureDurationCount) : 0,
      successRate: denominator ? Math.round((success / denominator) * 100) : 0,
      topTechnicians,
      topTypes: filteredTopTypes,
      topStatuses
    };
  }

  totalAmount(): number {
    return this.computeTotalAmount(this.summaryTotals(), this.ratesService.rates());
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
      this.statsDataset.set(items);
      return;
    }
    const statsQuery = this.buildQuery({ includePagination: false });
    statsQuery.page = 1;
    statsQuery.limit = safeTotal;
    this.svc.list(statsQuery).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.statsDataset.set(items);
          return;
        }
        this.statsDataset.set(res.data.items || items);
      },
      error: () => {
        this.statsDataset.set(items);
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

  private canonicalType(value?: string, item?: InterventionItem): string {
    const raw = (value ?? '').trim();
    const normalizedType = this.normalizeToken(raw).replace(/-/g, ' ');
    const normalizedTypeCollapsed = normalizedType.replace(/\s+/g, ' ').trim();
    const articlesNormalized = this.normalizeToken(item?.articlesRaw);
    const prestationsNormalized = this.normalizeToken(item?.listePrestationsRaw);
    const statusNormalized = this.normalizeToken(item?.statut);
    const operationNormalized = this.normalizeToken(item?.typeOperation);
    const commentsNormalized = this.normalizeToken(item?.commentairesTechnicien);
    if (articlesNormalized.includes('RACPAV')) {
      return 'RACPAV';
    }
    if (statusNormalized.includes('RACIH')) {
      return 'RACIH';
    }
    if (
      articlesNormalized.includes('RECOIP')
      || operationNormalized.includes('RECONNEX')
      || normalizedType.includes('RECO')
    ) {
      return 'RECOIP';
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      return 'RACPRO_S';
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      return 'RACPRO_C';
    }
    if (articlesNormalized.includes('SAV') || normalizedTypeCollapsed === 'SAV') {
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
    if (normalized === 'RACPAV') return 'PAV';
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
      value: this.formatDetailValue(item[field.key])
    }));
  }

  private formatDetailValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    return String(value);
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

  private normalizeToken(value?: string): string {
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
    const operationNormalized = this.normalizeToken(item.typeOperation);
    const commentsNormalized = this.normalizeToken(item.commentairesTechnicien);
    const prestationsNormalized = this.normalizeToken(item.listePrestationsRaw);
    const matches: string[] = [];

    if (articlesNormalized.includes('RACPAV')) matches.push('RACPAV');
    if (
      statusNormalized.includes('RACIH')
      || typeNormalized.includes('RACIH')
      || articlesNormalized.includes('RACIH')
    ) {
      matches.push('RACIH');
    }
    if (
      articlesNormalized.includes('RECOIP')
      || operationNormalized.includes('RECONNEX')
      || typeNormalized.includes('RECO')
    ) {
      matches.push('RECOIP');
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      matches.push('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      matches.push('RACPRO_C');
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
    if (articlesNormalized.includes('SAV') || typeNormalized === 'SAV') {
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
