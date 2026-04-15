import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, firstValueFrom } from 'rxjs';

import { MovementService } from '../../../core/services/movement.service';
import { TechnicianReportService, TechnicianReport } from '../../../core/services/technician-report.service';
import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import { AuthService } from '../../../core/services/auth.service';
import { BpuService } from '../../../core/services/bpu.service';
import { BpuSelectionService } from '../../../core/services/bpu-selection.service';
import { HrService } from '../../../core/services/hr.service';
import { Movement, Depot, User, BpuPriceHistory } from '../../../core/models';
import { Role } from '../../../core/models/roles.model';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';
import { normalizeDateRange } from '../../../core/utils/date-format';
import { computeReportAmount, normalizeReportPrestations, applyPricesToReport } from '../../../core/utils/technician-report-utils';
import { ReportPrestationsBadges } from '../../../shared/components/report-prestations-badges/report-prestations-badges';
import { AmountCurrencyPipe } from '../../../shared/pipes/amount-currency.pipe';
import { TechnicianBpuResolverService, pricesForDate } from '../../../core/services/technician-bpu-resolver.service';
import { apiError } from '../../../core/utils/http-error';

type SortField = 'date' | 'technician' | 'depot' | 'amount';

@Component({
  selector: 'app-technician-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ReportPrestationsBadges, AmountCurrencyPipe],
  providers: [DatePipe],
  templateUrl: './technician-activity.html',
  styleUrl: './technician-activity.scss'
})
export class TechnicianActivity {
  private movementService = inject(MovementService);
  private reportService = inject(TechnicianReportService);
  private userService = inject(UserService);
  private depotService = inject(DepotService);
  private auth = inject(AuthService);
  private bpuService = inject(BpuService);
  private bpuSelectionService = inject(BpuSelectionService);
  private bpuResolver = inject(TechnicianBpuResolverService);
  private hrService = inject(HrService);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);

  readonly users = signal<User[]>([]);
  readonly depots = signal<Depot[]>([]);
  readonly reservations = signal<Movement[]>([]);
  readonly interventions = signal<TechnicianReport[]>([]);
  readonly summaryTotalAmount = signal(0);
  readonly summaryTotalCount = signal(0);
  readonly reservationsLoading = signal(false);
  readonly interventionsLoading = signal(false);
  readonly summaryLoading = signal(false);
  readonly loadingUsers = signal(false);
  readonly loadingDepots = signal(false);
  readonly loadingBpu = signal(false);
  readonly loadingEmployees = signal(false);
  readonly error = signal<string | null>(null);
  readonly initialLoading = computed(() =>
    this.reservationsLoading()
    || this.interventionsLoading()
    || this.summaryLoading()
    || this.loadingUsers()
    || this.loadingDepots()
    || this.loadingBpu()
    || this.loadingEmployees()
  );

  readonly interventionPage = signal(1);
  readonly interventionLimit = signal(20);
  readonly interventionTotal = signal(0);
  readonly pageRange = formatPageRange;
  readonly interventionPageCount = computed(() => {
    const total = this.interventionTotal();
    const limit = this.interventionLimit();
    return limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  });
  readonly canPrevInterventions = computed(() => this.interventionPage() > 1);
  readonly canNextInterventions = computed(() => this.interventionPage() < this.interventionPageCount());
  readonly sortField = signal<SortField>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  readonly filterForm = this.fb.nonNullable.group({
    technicianId: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly bpuSelections = signal(new Map<string, Map<string, number>>());
  readonly bpuSegmentPrices = signal(new Map<string, Map<string, number>>());
  /** Sélections personnalisées par technicien : Map<technicianId, Map<code, price>> */
  readonly technicianPersonalPrices = signal(new Map<string, Map<string, number>>());
  readonly employeeContracts = signal(new Map<string, string>());
  readonly bpuLoaded = signal(false);
  readonly employeesLoaded = signal(false);
  readonly selectedTechnicianBpuPrices = signal<Map<string, number>>(new Map());
  readonly selectedTechnicianPriceHistory = signal<BpuPriceHistory[]>([]);
  readonly selectedTechnicianId = signal('');
  readonly hasCustomBpu = signal(false);
  readonly selectedTechnicianLabel = computed(() => {
    const techId = this.selectedTechnicianId();
    if (!techId) return '';
    const match = this.users().find((u) => u._id === techId);
    if (!match) return '';
    const parts = [match.firstName, match.lastName].filter(Boolean);
    return parts.join(' ').trim();
  });
  readonly sortedInterventions = computed(() => {
    const items = [...this.interventions()];
    const field = this.sortField();
    const dir = this.sortDirection();
    const factor = dir === 'asc' ? 1 : -1;
    const byText = (value: string) => value.toLowerCase();
    const compareText = (a: string, b: string) => byText(a).localeCompare(byText(b));
    items.sort((a, b) => {
      switch (field) {
        case 'technician':
          return factor * compareText(this.technicianName(a), this.technicianName(b));
        case 'depot':
          return factor * compareText(this.depotName(a), this.depotName(b));
        case 'amount':
          return factor * ((this.reportAmount(a) || 0) - (this.reportAmount(b) || 0));
        case 'date':
        default: {
          const aTime = new Date(a.reportDate || 0).getTime();
          const bTime = new Date(b.reportDate || 0).getTime();
          return factor * (aTime - bTime);
        }
      }
    });
    return items;
  });
  readonly visiblePageAmount = computed(() =>
    this.interventions().reduce((sum, report) => sum + Number(this.reportAmount(report) || 0), 0)
  );

  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly managerDepotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) return String((raw as { _id: string })._id);
    return null;
  });

  constructor() {
    this.loadUsers();
    this.loadDepots();
    void this.ensureBpuSelections();
    void this.ensureEmployeeContracts();
    this.refreshAll();

    this.selectedTechnicianId.set(this.filterForm.controls.technicianId.value || '');
    void this.loadSelectedTechnicianBpu();
    this.filterForm.controls.technicianId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.selectedTechnicianId.set(value || '');
        void this.loadSelectedTechnicianBpu();
      });
  }

  refreshAll(): void {
    this.refreshReservations();
    this.refreshInterventions();
    this.refreshSummary();
  }

  refreshReservations(): void {
    const filters = this.filterForm.getRawValue();
    const dates = normalizeDateRange(filters.fromDate, filters.toDate);
    const depotId = this.isDepotManager() ? (this.managerDepotId() ?? undefined) : (filters.depot || undefined);
    const technicianId = filters.technicianId || undefined;

    this.reservationsLoading.set(true);
    this.error.set(null);

    forkJoin([
      this.movementService.listRaw({
        resourceType: 'CONSUMABLE',
        action: 'ASSIGN',
        toType: 'USER',
        toId: technicianId,
        depotId: depotId || undefined,
        fromDate: dates.fromDate,
        toDate: dates.toDate,
        page: 1,
        limit: 50
      }),
      this.movementService.listRaw({
        resourceType: 'MATERIAL',
        action: 'ASSIGN',
        toType: 'USER',
        toId: technicianId,
        depotId: depotId || undefined,
        fromDate: dates.fromDate,
        toDate: dates.toDate,
        page: 1,
        limit: 50
      })
    ]).subscribe({
      next: ([consumables, materials]) => {
        const combined = [...(consumables.items ?? []), ...(materials.items ?? [])];
        combined.sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime();
          const bTime = new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        this.reservations.set(combined);
        this.reservationsLoading.set(false);
      },
      error: (err) => {
        this.reservationsLoading.set(false);
        this.error.set(apiError(err, 'Erreur chargement attributions'));
      }
    });
  }

  refreshInterventions(): void {
    const filters = this.filterForm.getRawValue();
    const dates = normalizeDateRange(filters.fromDate, filters.toDate);
    const depotId = this.isDepotManager() ? (this.managerDepotId() ?? undefined) : (filters.depot || undefined);
    const technicianId = filters.technicianId || undefined;

    this.interventionsLoading.set(true);
    this.error.set(null);
    this.reportService.list({
      fromDate: dates.fromDate,
      toDate: dates.toDate,
      technicianId,
      depotId,
      page: this.interventionPage(),
      limit: this.interventionLimit()
    }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set('Erreur chargement interventions');
          this.interventionsLoading.set(false);
          return;
        }
        this.interventions.set(res.data.items || []);
        this.interventionTotal.set(res.data.total || 0);
        this.interventionsLoading.set(false);
      },
      error: (err) => {
        this.interventionsLoading.set(false);
        this.error.set(apiError(err, 'Erreur chargement interventions'));
      }
    });
  }

  applyFilters(): void {
    this.interventionPage.set(1);
    this.refreshAll();
  }

  clearFilters(): void {
    this.filterForm.setValue({ technicianId: '', depot: '', fromDate: '', toDate: '' });
    this.interventionPage.set(1);
    this.refreshAll();
  }

  prevInterventions(): void {
    if (!this.canPrevInterventions()) return;
    this.interventionPage.set(this.interventionPage() - 1);
    this.refreshInterventions();
  }

  nextInterventions(): void {
    if (!this.canNextInterventions()) return;
    this.interventionPage.set(this.interventionPage() + 1);
    this.refreshInterventions();
  }

  setInterventionLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.interventionLimit.set(value);
    this.interventionPage.set(1);
    this.refreshInterventions();
  }

  resourceLabel(m: Movement): string {
    return m.resourceLabel || m.resourceId || '—';
  }

  resourceTypeLabel(m: Movement): string {
    return m.resourceType === 'MATERIAL' ? 'Matériel' : 'Consommable';
  }

  technicianLabelById(id?: string | null): string {
    if (!id) return '—';
    const user = this.users().find((u) => u._id === id);
    if (!user) return this.shortId(id);
    const name = formatPersonName(user.firstName ?? '', user.lastName ?? '');
    return name || user.email || this.shortId(id);
  }

  depotLabelById(id?: string | null): string {
    if (!id) return '—';
    const depot = this.depots().find((d) => d._id === id);
    return depot?.name ? formatDepotName(depot.name) : this.shortId(id);
  }

  interventionDateLabel(item: TechnicianReport): string {
    return this.datePipe.transform(item.reportDate as any, 'shortDate') || '—';
  }

  technicianName(report: TechnicianReport): string {
    const tech = report.technician;
    if (!tech) return '—';
    const name = formatPersonName(tech.firstName ?? '', tech.lastName ?? '');
    return name || tech.email || '—';
  }

  depotName(report: TechnicianReport): string {
    const depot = report.depot;
    if (!depot?.name) return '—';
    return formatDepotName(depot.name);
  }

  sortArrow(field: SortField): string {
    if (this.sortField() !== field) return '';
    return this.sortDirection() === 'asc' ? '▲' : '▼';
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortField.set(field);
    this.sortDirection.set(field === 'date' || field === 'amount' ? 'desc' : 'asc');
  }

  prestationsSummary(report: TechnicianReport): Array<{ code: string; qty: number }> {
    return normalizeReportPrestations(report).map(({ code, qty }) => ({ code, qty }));
  }

  reportAmount(report: TechnicianReport): number {
    if (this.shouldUseSelectedTechnicianPrices(report)) {
      const prices = pricesForDate(
        this.selectedTechnicianPriceHistory(),
        report.reportDate,
        this.selectedTechnicianBpuPrices()
      );
      return applyPricesToReport(report, prices);
    }
    const techId = String(report.technician?._id || '').trim();
    // 1. Sélection personnalisée du technicien (OVERRIDE)
    const personalPrices = techId ? this.technicianPersonalPrices().get(techId) : undefined;
    if (personalPrices?.size) {
      return applyPricesToReport(report, personalPrices);
    }
    // 2. Prix du segment BPU admin (AUTO/SALARIE/AUTRE)
    const segment = this.resolveBpuSegment(techId || null);
    const segmentPrices = this.bpuSegmentPrices().get(segment);
    if (segmentPrices?.size) {
      return applyPricesToReport(report, segmentPrices);
    }
    return computeReportAmount(report);
  }

  reportBpuLabel(report: TechnicianReport): string {
    const type = this.resolveBpuSegment(report.technician?._id);
    if (type === 'AUTO') return 'AUTO';
    if (type === 'AUTRE') return 'AUTRE';
    return 'SALARIE';
  }

  readonly selectedBpuLabel = computed(() => {
    const techId = this.selectedTechnicianId();
    if (!techId) return '';
    if (this.hasCustomBpu()) {
      const label = this.selectedTechnicianLabel();
      return label ? `Suivi - ${label}` : 'Suivi';
    }
    const type = this.resolveBpuSegment(techId);
    if (type === 'AUTO') return 'AUTO';
    if (type === 'AUTRE') return 'AUTRE';
    return 'SALARIE';
  });

  totalAmount(): number {
    return this.summaryTotalAmount();
  }

  private loadUsers(): void {
    this.loadingUsers.set(true);
    this.userService.refreshUsers(true, {
      page: 1,
      limit: 500,
      depot: this.isDepotManager() ? this.managerDepotId() ?? undefined : undefined
    }).subscribe({
      next: (res) => {
        this.users.set(res.items ?? []);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false)
    });
  }

  private loadDepots(): void {
    if (this.isDepotManager()) {
      const depotId = this.managerDepotId();
      if (!depotId) {
        this.depots.set([]);
        return;
      }
      this.loadingDepots.set(true);
      this.depotService.getDepot(depotId).subscribe({
        next: (depot) => {
          this.depots.set([depot]);
          this.loadingDepots.set(false);
        },
        error: () => this.loadingDepots.set(false)
      });
      return;
    }
    this.loadingDepots.set(true);
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.loadingDepots.set(false);
      },
      error: () => this.loadingDepots.set(false)
    });
  }


  private summaryRequestId = 0;
  private selectedBpuRequestId = 0;

  private async refreshSummary(): Promise<void> {
    const requestId = ++this.summaryRequestId;
    const filters = this.filterForm.getRawValue();
    const dates = normalizeDateRange(filters.fromDate, filters.toDate);
    const depotId = this.isDepotManager() ? (this.managerDepotId() ?? undefined) : (filters.depot || undefined);
    const technicianId = filters.technicianId || undefined;

    this.summaryLoading.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(this.reportService.summary({
        fromDate: dates.fromDate,
        toDate: dates.toDate,
        technicianId,
        depotId
      }));
      if (requestId !== this.summaryRequestId) return;
      if (!res?.success) {
        throw new Error('Erreur chargement montant');
      }
      const count = Number(res.data?.count || 0);
      let totalAmount = Number(res.data?.totalAmount || 0);

      if (technicianId) {
        totalAmount = await this.loadSummaryAmountFromReports({
          technicianId,
          depotId,
          fromDate: dates.fromDate,
          toDate: dates.toDate,
          fallback: totalAmount,
          totalCount: count
        });
      }

      this.summaryTotalAmount.set(totalAmount);
      this.summaryTotalCount.set(count);
    } catch (err) {
      if (requestId !== this.summaryRequestId) return;
      this.error.set(apiError(err, 'Erreur chargement montant'));
    } finally {
      if (requestId !== this.summaryRequestId) return;
      this.summaryLoading.set(false);
    }
  }

  private resolveBpuSegment(technicianId?: string | null): string {
    if (!technicianId) return 'SALARIE';
    const contract = this.employeeContracts().get(technicianId) || '';
    if (contract === 'AUTRE') return 'AUTRE';
    if (contract === 'FREELANCE') return 'AUTO';
    return 'SALARIE';
  }

  private async ensureBpuSelections(): Promise<void> {
    if (this.bpuLoaded() || this.loadingBpu()) return;
    this.loadingBpu.set(true);
    try {
      const [globalSelections, personalSelections, bpuItems] = await Promise.all([
        firstValueFrom(this.bpuSelectionService.list()),
        firstValueFrom(this.bpuSelectionService.list({ owner: 'all' })),
        firstValueFrom(this.bpuService.list())
      ]);

      // Sélections globales par type (AUTO/SALARIE/AUTRE…)
      const selectionMap = new Map<string, Map<string, number>>();
      for (const selection of globalSelections || []) {
        const type = String(selection.type || '').trim().toUpperCase();
        if (!type) continue;
        const priceMap = new Map<string, number>();
        for (const entry of selection.prestations || []) {
          const code = String(entry.code || '').trim().toUpperCase();
          if (!code) continue;
          priceMap.set(code, Number(entry.unitPrice || 0));
        }
        selectionMap.set(type, priceMap);
      }
      this.bpuSelections.set(selectionMap);

      // Sélections personnalisées par technicien (owner != null)
      const personalMap = new Map<string, Map<string, number>>();
      for (const selection of personalSelections || []) {
        const ownerId = String((selection as any).owner || '').trim();
        if (!ownerId) continue;
        const priceMap = new Map<string, number>();
        for (const entry of selection.prestations || []) {
          const code = String(entry.code || '').trim().toUpperCase();
          if (!code) continue;
          priceMap.set(code, Number(entry.unitPrice || 0));
        }
        if (priceMap.size) personalMap.set(ownerId, priceMap);
      }
      this.technicianPersonalPrices.set(personalMap);

      // Catalogue BPU admin (source de vérité pour les prix par segment)
      const segmentMap = new Map<string, Map<string, number>>();
      for (const item of bpuItems || []) {
        const seg = String(item.segment || '').trim().toUpperCase();
        const code = String(item.code || '').trim().toUpperCase();
        if (!seg || !code) continue;
        if (!segmentMap.has(seg)) segmentMap.set(seg, new Map());
        segmentMap.get(seg)!.set(code, Number(item.unitPrice || 0));
      }
      this.bpuSegmentPrices.set(segmentMap);

      this.bpuLoaded.set(true);
    } finally {
      this.loadingBpu.set(false);
    }
  }

  private async loadSelectedTechnicianBpu(): Promise<void> {
    const requestId = ++this.selectedBpuRequestId;
    const techId = this.selectedTechnicianId();
    if (!techId) {
      this.selectedTechnicianBpuPrices.set(new Map());
      this.hasCustomBpu.set(false);
      return;
    }
    try {
      const state = await firstValueFrom(this.bpuResolver.resolve(techId));
      if (requestId !== this.selectedBpuRequestId) return;
      this.selectedTechnicianBpuPrices.set(state.prices);
      this.selectedTechnicianPriceHistory.set(state.priceHistory);
      this.hasCustomBpu.set(state.usesPersonalizedBpu);
    } catch {
      if (requestId !== this.selectedBpuRequestId) return;
      this.selectedTechnicianBpuPrices.set(new Map());
      this.selectedTechnicianPriceHistory.set([]);
      this.hasCustomBpu.set(false);
    } finally {
      if (requestId !== this.selectedBpuRequestId) return;
      void this.refreshSummary();
    }
  }

  private shouldUseSelectedTechnicianPrices(report: TechnicianReport): boolean {
    const techId = this.selectedTechnicianId();
    if (!techId || !this.selectedTechnicianBpuPrices().size) return false;
    const reportTechId = String(report.technician?._id || '').trim();
    return !reportTechId || reportTechId === techId;
  }

  private async loadSummaryAmountFromReports(params: {
    technicianId: string;
    depotId?: string;
    fromDate?: string;
    toDate?: string;
    fallback: number;
    totalCount: number;
  }): Promise<number> {
    const basePrices = this.selectedTechnicianBpuPrices();
    if (!basePrices.size) return params.fallback;

    const res = await firstValueFrom(this.reportService.list({
      technicianId: params.technicianId,
      depotId: params.depotId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      page: 1,
      limit: Math.max(1, params.totalCount)
    }));

    if (!res?.success) return params.fallback;
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    if (!items.length) return 0;

    const history = this.selectedTechnicianPriceHistory();
    return Number(
      items.reduce((sum, report) => {
        const prices = pricesForDate(history, report.reportDate, basePrices);
        return sum + applyPricesToReport(report, prices);
      }, 0).toFixed(2)
    );
  }

  private async ensureEmployeeContracts(): Promise<void> {
    if (this.employeesLoaded() || this.loadingEmployees()) return;
    this.loadingEmployees.set(true);
    try {
      const res = await firstValueFrom(this.hrService.listEmployees({ role: 'TECHNICIEN', page: 1, limit: 2000 }));
      const map = new Map<string, string>();
      for (const entry of res.items || []) {
        const id = entry.user?._id;
        if (!id) continue;
        const contract = entry.profile?.contractType || '';
        map.set(id, contract);
      }
      this.employeeContracts.set(map);
      this.employeesLoaded.set(true);
    } finally {
      this.loadingEmployees.set(false);
    }
  }

  private shortId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
  }
}
