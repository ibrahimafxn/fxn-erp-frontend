import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import {
  InterventionFilters,
  InterventionItem,
  InterventionService,
  InterventionSummaryQuery
} from '../../../core/services/intervention.service';
import { User, Role } from '../../../core/models';
import { UserService } from '../../../core/services/user.service';
import { formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

type TechnicianInterventionStats = {
  total: number;
  success: number;
  failure: number;
  avgDuration: number;
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
  successRate: 0,
  topTechnicians: [],
  topTypes: [],
  topStatuses: []
};

type SortField = 'date' | 'type' | 'statut' | 'duree';

const TYPE_CANONICAL_ALIASES = new Map([
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
  ['RECOIP', 'RECO'],
  ['RECO IP', 'RECO'],
  ['RECO-IP', 'RECO'],
  ['RECO', 'RECO']
]);
const REQUIRED_TYPE_LABELS = ['RECO'];

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
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  readonly filterLoading = signal(false);
  readonly filtersError = signal<string | null>(null);
  readonly filters = signal<InterventionFilters | null>(null);
  readonly technicians = signal<User[]>([]);

  readonly tableLoading = signal(false);
  readonly tableError = signal<string | null>(null);
  readonly interventions = signal<InterventionItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(20);

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
    status: this.fb.nonNullable.control(''),
    type: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly statsDataset = signal<InterventionItem[]>([]);
  readonly stats = computed(() => this.computeStats(this.statsDataset(), this.total()));
  readonly failurePercent = computed(() => this.computeFailurePercent(this.stats()));
  readonly successRateBg = computed(() => this.computeSuccessRateBg(this.stats().successRate));
  readonly reconnectionCount = computed(() => this.countMatchingType('RECO'));
  readonly sortField = signal<SortField>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly sortedInterventions = computed(() => this.sortedItems());
  constructor() {
    this.loadFilters();
    this.loadTechnicians();
    this.loadInterventions();
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadInterventions();
  }

  clearFilters(): void {
    this.filterForm.reset({
      technician: '',
      region: '',
      client: '',
      status: '',
      type: '',
      fromDate: '',
      toDate: ''
    });
    this.page.set(1);
    this.loadInterventions();
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
          this.filters.set(res.data);
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

  private buildQuery(options?: { includePagination?: boolean }): InterventionSummaryQuery {
    const filters = this.filterForm.getRawValue();
    const range = this.normalizeDateRange(filters.fromDate, filters.toDate);
    return {
      technician: filters.technician || undefined,
      region: filters.region || undefined,
      client: filters.client || undefined,
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

  private computeStats(items: InterventionItem[], totalCount: number): TechnicianInterventionStats {
    const total = Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : items.length;
    if (!items.length) return { ...EMPTY_STATS, total };
    let success = 0;
    let failure = 0;
    let durationSum = 0;
    let durationCount = 0;
    const technicians = new Map<string, { success: number; failure: number }>();
    const types = new Map<string, number>();
    const statuses = new Map<string, number>();

    for (const item of items) {
      const statut = (item.statut ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (statut.includes('echec') || statut.includes('fail')) {
        failure++;
      } else if (statut.includes('termine') || statut.includes('cloture')) {
        success++;
      }
      const isCancelled = statut.includes('annul');
      const isEchecTermine = statut.includes('echec') && statut.includes('termine');
      const isCompleted = statut.includes('termine') || statut.includes('cloture') || isEchecTermine;
      const value = isCompleted ? this.computeDuration(item) : 0;
      if (Number.isFinite(value) && value > 0 && !isCancelled) {
        durationSum += value;
        durationCount++;
      }
      const techLabel = this.formatTechnicianName(item);
      const techStats = technicians.get(techLabel) ?? { success: 0, failure: 0 };
      if (statut.includes('echec') || statut.includes('fail')) {
        techStats.failure = (techStats.failure || 0) + 1;
      } else if (statut.includes('termine') || statut.includes('cloture')) {
        techStats.success = (techStats.success || 0) + 1;
      }
      technicians.set(techLabel, techStats);
      const typeLabel = this.canonicalType(item.type, item);
      types.set(typeLabel, (types.get(typeLabel) ?? 0) + 1);
      const statusLabel = item.statut?.trim() || 'Autre';
      statuses.set(statusLabel, (statuses.get(statusLabel) ?? 0) + 1);
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
    const filteredTopTypes = baseTopTypes.filter(
      (type) => type.label !== 'RACPRO_S' && type.label !== 'RACPRO_C'
    );
    const enforcedTypes = REQUIRED_TYPE_LABELS
      .filter((label) => !baseTopTypes.some((type) => type.label === label))
      .map((label) => ({ label, count: types.get(label) ?? 0 }));
    const topTypes = [...filteredTopTypes, ...enforcedTypes];
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
      successRate: denominator ? Math.round((success / denominator) * 100) : 0,
      topTechnicians,
      topTypes,
      topStatuses
    };
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

  formatDuration(item: InterventionItem): string {
    const minutes = this.computeDuration(item);
    return minutes > 0 ? `${minutes} min` : '';
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
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  applyView(view: 'topTech' | 'failures' | 'reconnections'): void {
    if (view === 'failures') {
      this.filterForm.controls.status.setValue(this.chooseFailureStatus());
      this.filterForm.controls.type.setValue('');
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
    const normalizedType = this.normalizeToken(raw);
    const articlesNormalized = this.normalizeToken(item?.articlesRaw);
    if (articlesNormalized.includes('RACPRO_S')) {
      return 'RACPRO_S';
    }
    if (articlesNormalized.includes('RACPRO_C')) {
      return 'RACPRO_C';
    }
    const statusNormalized = this.normalizeToken(item?.statut);
    const operationNormalized = this.normalizeToken(item?.typeOperation);
    const isClosedTerminated =
      statusNormalized.includes('CLOTURE') && statusNormalized.includes('TERMINE');
    const isReconnectionOperation = normalizedType === 'RECO' || operationNormalized.includes('RECONNEX');
    if (articlesNormalized.includes('RECOIP') || (isClosedTerminated && isReconnectionOperation)) {
      return 'RECO';
    }
    if (!raw) return 'Autre';
    const normalized = raw.toUpperCase().replace(/\s+/g, ' ').replace(/-/g, ' ');
    return TYPE_CANONICAL_ALIASES.get(normalized) ?? raw;
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
    const end = { r: 16, g: 185, b: 129 };
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
}
