import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { MovementService } from '../../../core/services/movement.service';
import { TechnicianReportService, TechnicianReport } from '../../../core/services/technician-report.service';
import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import { AuthService } from '../../../core/services/auth.service';
import { Movement, Depot, User } from '../../../core/models';
import { Role } from '../../../core/models/roles.model';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';

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
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);

  readonly users = signal<User[]>([]);
  readonly depots = signal<Depot[]>([]);
  readonly reservations = signal<Movement[]>([]);
  readonly interventions = signal<TechnicianReport[]>([]);
  readonly reservationsLoading = signal(false);
  readonly interventionsLoading = signal(false);
  readonly loadingUsers = signal(false);
  readonly loadingDepots = signal(false);
  readonly error = signal<string | null>(null);

  readonly interventionPage = signal(1);
  readonly interventionLimit = signal(25);
  readonly interventionTotal = signal(0);
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
    this.refreshAll();
  }

  refreshAll(): void {
    this.refreshReservations();
    this.refreshInterventions();
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
