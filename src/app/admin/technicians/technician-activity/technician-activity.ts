import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, firstValueFrom } from 'rxjs';

import { MovementService } from '../../../core/services/movement.service';
import { TechnicianReportService, TechnicianReport } from '../../../core/services/technician-report.service';
import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import { AuthService } from '../../../core/services/auth.service';
import { BpuSelectionService } from '../../../core/services/bpu-selection.service';
import { HrService } from '../../../core/services/hr.service';
import { Movement, Depot, User } from '../../../core/models';
import { Role } from '../../../core/models/roles.model';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

@Component({
  selector: 'app-technician-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  private bpuSelectionService = inject(BpuSelectionService);
  private hrService = inject(HrService);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);

  readonly users = signal<User[]>([]);
  readonly depots = signal<Depot[]>([]);
  readonly reservations = signal<Movement[]>([]);
  readonly interventions = signal<TechnicianReport[]>([]);
  readonly summaryTotalAmount = signal(0);
  readonly reservationsLoading = signal(false);
  readonly interventionsLoading = signal(false);
  readonly summaryLoading = signal(false);
  readonly loadingUsers = signal(false);
  readonly loadingDepots = signal(false);
  readonly loadingBpu = signal(false);
  readonly loadingEmployees = signal(false);
  readonly error = signal<string | null>(null);

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

  readonly filterForm = this.fb.nonNullable.group({
    technicianId: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly prestationOptions = [
    { key: 'professionnel', label: 'Professionnel' },
    { key: 'pavillon', label: 'Pavillon' },
    { key: 'immeuble', label: 'Immeuble' },
    { key: 'prestaComplementaire', label: 'Presta Compl.' },
    { key: 'reconnexion', label: 'Reconnexion' },
    { key: 'sav', label: 'SAV' },
    { key: 'prestationF8', label: 'Prestation F8' }
  ] as const;
  readonly bpuSelections = signal(new Map<string, Map<string, number>>());
  readonly employeeContracts = signal(new Map<string, string>());
  readonly bpuLoaded = signal(false);
  readonly employeesLoaded = signal(false);

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
  }

  refreshAll(): void {
    this.refreshReservations();
    this.refreshInterventions();
    this.refreshSummary();
  }

  refreshReservations(): void {
    const filters = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(filters.fromDate, filters.toDate);
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
        this.error.set(this.apiError(err, 'Erreur chargement attributions'));
      }
    });
  }

  refreshInterventions(): void {
    const filters = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(filters.fromDate, filters.toDate);
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
        this.error.set(this.apiError(err, 'Erreur chargement interventions'));
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

  prestationsSummary(report: TechnicianReport): Array<{ key: string; label: string; value: number }> {
    const p = report.prestations || {};
    return this.prestationOptions
      .map((option) => ({
        key: option.key,
        label: option.label,
        value: Number(p[option.key] || 0)
      }))
      .filter((item) => item.value > 0);
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

  reportAmount(report: TechnicianReport): number {
    return this.computeBpuAmount(report);
  }

  reportBpuLabel(report: TechnicianReport): string {
    const type = this.resolveBpuSegment(report.technician?._id);
    if (type === 'AUTO') return 'AUTO';
    if (type === 'ASSOCIE') return 'AUTRE';
    return 'SALARIE';
  }

  readonly selectedBpuLabel = computed(() => {
    const techId = this.filterForm.value.technicianId || '';
    if (!techId) return '';
    const type = this.resolveBpuSegment(techId);
    if (type === 'AUTO') return 'AUTO';
    if (type === 'ASSOCIE') return 'AUTRE';
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

  private normalizeDateRange(from: string, to: string): { fromDate?: string; toDate?: string } {
    const fromDate = from ? String(from) : '';
    const toDate = to ? String(to) : '';
    return {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined
    };
  }

  private summaryRequestId = 0;

  private async refreshSummary(): Promise<void> {
    const requestId = ++this.summaryRequestId;
    const filters = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(filters.fromDate, filters.toDate);
    const depotId = this.isDepotManager() ? (this.managerDepotId() ?? undefined) : (filters.depot || undefined);
    const technicianId = filters.technicianId || undefined;

    this.summaryLoading.set(true);
    this.error.set(null);
    await this.ensureBpuSelections();
    await this.ensureEmployeeContracts();

    const baseQuery = {
      fromDate: dates.fromDate,
      toDate: dates.toDate,
      technicianId,
      depotId
    };

    const limit = 200;
    let page = 1;
    let total = 0;
    let amount = 0;

    try {
      do {
        const res = await firstValueFrom(this.reportService.list({ ...baseQuery, page, limit }));
        if (requestId !== this.summaryRequestId) return;
        if (!res?.success) {
          throw new Error('Erreur chargement montant');
        }
        const items = res.data.items || [];
        for (const item of items) {
          amount += this.computeBpuAmount(item);
        }
        total = res.data.total ?? (items.length + (page - 1) * limit);
        page += 1;
      } while ((page - 1) * limit < total);

      if (requestId !== this.summaryRequestId) return;
      this.summaryTotalAmount.set(amount);
    } catch (err) {
      if (requestId !== this.summaryRequestId) return;
      this.error.set(this.apiError(err, 'Erreur chargement montant'));
    } finally {
      if (requestId !== this.summaryRequestId) return;
      this.summaryLoading.set(false);
    }
  }

  private computeBpuAmount(report: TechnicianReport): number {
    const prices = this.resolveBpuPrices(report.technician?._id);
    const p = report.prestations || {};
    const get = (value?: number) => Number(value || 0);
    return (
      get(p.professionnel) * this.getBpuUnit(prices, 'RACPRO_S')
      + get(p.racProC) * this.getBpuUnit(prices, 'RACPRO_C')
      + get(p.pavillon) * this.getBpuUnit(prices, 'RACPAV')
      + get(p.immeuble) * this.getBpuUnit(prices, 'RACIH')
      + get(p.prestaComplementaire) * this.getBpuUnit(prices, 'PRESTA_COMPL')
      + get(p.reconnexion) * this.getBpuUnit(prices, 'RECOIP')
      + get(p.sav) * this.getBpuUnit(prices, 'SAV')
      + get(p.prestationF8) * this.getBpuUnit(prices, 'REPFOU_PRI')
    );
  }

  private getBpuUnit(prices: Map<string, number> | null, code: string): number {
    if (!prices) return 0;
    return Number(prices.get(code) || 0);
  }

  private resolveBpuPrices(technicianId?: string | null): Map<string, number> | null {
    const type = this.resolveBpuSegment(technicianId);
    return this.bpuSelections().get(type) || null;
  }

  private resolveBpuSegment(technicianId?: string | null): string {
    if (!technicianId) return 'SALARIE';
    const contract = this.employeeContracts().get(technicianId) || '';
    if (contract === 'AUTRE') return 'ASSOCIE';
    if (contract === 'FREELANCE') return 'AUTO';
    return 'SALARIE';
  }

  private async ensureBpuSelections(): Promise<void> {
    if (this.bpuLoaded() || this.loadingBpu()) return;
    this.loadingBpu.set(true);
    try {
      const items = await firstValueFrom(this.bpuSelectionService.list());
      const map = new Map<string, Map<string, number>>();
      for (const selection of items || []) {
        const type = String(selection.type || '').trim().toUpperCase();
        if (!type) continue;
        const priceMap = new Map<string, number>();
        for (const entry of selection.prestations || []) {
          const code = String(entry.code || '').trim().toUpperCase();
          if (!code) continue;
          priceMap.set(code, Number(entry.unitPrice || 0));
        }
        map.set(type, priceMap);
      }
      this.bpuSelections.set(map);
      this.bpuLoaded.set(true);
    } finally {
      this.loadingBpu.set(false);
    }
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

  private apiError(err: any, fallback: string): string {
    const apiMsg =
      typeof err?.error === 'object' && err.error !== null && 'message' in err.error
        ? String(err.error.message ?? '')
        : '';
    return apiMsg || err?.message || fallback;
  }

  private shortId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
  }
}
