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
    this.loadInterventions();
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
      const value = Number(item.duree ?? 0);
      const isCancelled = statut.includes('annul');
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
      const typeLabel = item.type?.trim() || 'Autre';
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
    const topTypes = Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
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
        case 'duree':
          return direction * (Number(a.duree ?? 0) - Number(b.duree ?? 0));
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
    this.filterForm.patchValue({
      technician: '',
      status: '',
      type: ''
    });
    if (view === 'failures') {
      this.filterForm.controls.status.setValue('Échec');
    } else if (view === 'reconnections') {
      this.filterForm.controls.type.setValue('Recon');
    }
    if (view === 'topTech') {
      this.sortField.set('duree');
      this.sortDirection.set('desc');
    }
    this.page.set(1);
    this.loadInterventions();
  }

  statusClass(item: InterventionItem): string {
    const stat = (item.statut ?? '').toLowerCase();
    if (stat.includes('echec') || stat.includes('fail')) return 'status-error';
    if (stat.includes('termine') || stat.includes('complet') || stat.includes('ok')) return 'status-success';
    return 'status-neutral';
  }

  formatTechnicianName(item: InterventionItem): string {
    const formatted = formatPersonName(item.techFirstName ?? '', item.techLastName ?? '');
    return formatted || item.techFull || '–';
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
}
