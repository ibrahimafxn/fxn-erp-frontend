// src/app/admin/resources/vehicles/vehicle-detail/vehicle-detail.ts
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { VehicleService, AssignVehiclePayload, ReleaseVehiclePayload } from '../../../../core/services/vehicle.service';
import { DepotService } from '../../../../core/services/depot.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models';

import { Vehicle, Depot, User, VehicleBreakdown } from '../../../../core/models';
import { VehicleHistoryItem, VehicleHistoryResult } from '../../../../core/models/vehicle-history.model';
import {DetailBack} from '../../../../core/utils/detail-back';
import { formatDepotName, formatPersonName } from '../../../../core/utils/text-format';
import { formatPageRange } from '../../../../core/utils/pagination';

type AssignMode = 'idle' | 'assign' | 'release';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vehicle-detail',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule],
  templateUrl: './vehicle-detail.html',
  styleUrls: ['./vehicle-detail.scss'],
})
export class VehicleDetail extends DetailBack {
  private svc = inject(VehicleService);
  private depotSvc = inject(DepotService);
  private userSvc = inject(UserService);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private datePipe = inject(DatePipe);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  // -----------------------------
  // Vehicle state
  // -----------------------------
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly vehicle = signal<Vehicle | null>(null);

  readonly hasVehicle = computed(() => this.vehicle() !== null);

  // -----------------------------
  // Tech candidates
  // -----------------------------
  readonly techniciansLoading = signal(false);
  readonly techniciansError = signal<string | null>(null);
  readonly technicians = signal<User[]>([]);

  // -----------------------------
  // Depots (release)
  // -----------------------------
  readonly depotsLoading = signal(false);
  readonly depotsError = signal<string | null>(null);
  readonly depots = signal<Depot[]>([]);

  // -----------------------------
  // Actions (assign/release)
  // -----------------------------
  readonly assignMode = signal<AssignMode>('idle');
  readonly actionSaving = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly selectedTechId = signal<string>('');
  readonly selectedDepotId = signal<string>('');
  readonly assignNote = signal<string>('');
  readonly releaseNote = signal<string>('');

  // -----------------------------
  // History (timeline)
  // -----------------------------
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly history = signal<VehicleHistoryResult | null>(null);

  readonly historyPage = signal(1);
  readonly historyLimit = signal(10);
  readonly pageRange = formatPageRange;

  readonly historyItems = computed<VehicleHistoryItem[]>(() => this.history()?.items ?? []);
  readonly historyTotal = computed(() => this.history()?.total ?? 0);
  readonly historyPageCount = computed(() => {
    const t = this.historyTotal();
    const l = this.historyLimit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly canPrevHistory = computed(() => this.historyPage() > 1);
  readonly canNextHistory = computed(() => this.historyPage() < this.historyPageCount());

  // -----------------------------
  // Latest breakdown
  // -----------------------------
  readonly breakdownLoading = signal(false);
  readonly breakdownError = signal<string | null>(null);
  readonly latestBreakdown = signal<VehicleBreakdown | null>(null);

  // -----------------------------
  // Derived
  // -----------------------------
  readonly isAssigned = computed(() => {
    const v = this.vehicle();
    return !!v?.assignedTo;
  });

  readonly statusLabel = computed(() => (this.isAssigned() ? 'Assigné' : 'Disponible'));
  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly isReadOnly = computed(() => this.auth.getUserRole() === Role.TECHNICIEN);
  readonly canDeclareBreakdown = computed(() => {
    const role = this.auth.getUserRole();
    return role === Role.ADMIN || role === Role.DIRIGEANT || role === Role.GESTION_DEPOT;
  });

  constructor() {
    super();
    this.loadDepots();
    if (!this.isReadOnly()) {
      this.loadTechnicians();
    }
    this.load();
  }

  // -----------------------------
  // Labels helpers
  // -----------------------------
  titleLabel(): string {
    const v = this.vehicle();
    if (!v) return 'Détail véhicule';

    const parts: string[] = [];
    if (v.brand) parts.push(v.brand);
    if (v.model) parts.push(v.model);

    const label = parts.join(' ').trim();
    return label || (v.plateNumber ?? 'Véhicule');
  }

  plateLabel(): string {
    return this.vehicle()?.plateNumber ?? '—';
  }

  yearLabel(): string {
    const y = this.vehicle()?.year;
    return typeof y === 'number' ? String(y) : '—';
  }

  createdAtValue(): string | Date | null {
    return this.vehicle()?.createdAt ?? null;
  }

  depotPreviewLabel(): string {
    const v = this.vehicle();
    if (!v) return '—';

    const d = v.idDepot;
    if (!d) return '—';

    if (typeof d === 'object' && '_id' in d) {
      const obj = d as { _id: string; name?: string };
      return formatDepotName(obj.name) || '—';
    }

    if (typeof d === 'string') {
      const match = this.depots().find(item => item._id === d);
      return match ? (formatDepotName(match.name ?? '') || '—') : '—';
    }

    return '—';
  }

  assignedToLabel(): string {
    const v = this.vehicle();
    if (!v || !v.assignedTo) return '—';

    const a = v.assignedTo;
    if (typeof a === 'object' && '_id' in a) {
      const u = a as { _id: string; firstName?: string; lastName?: string; email?: string };
      const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
      return name || u.email || '—';
    }

    return '—';
  }

  technicianLabel(t: User): string {
    const name = formatPersonName(t.firstName ?? '', t.lastName ?? '');
    return name || t.email || t._id;
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }

  // -----------------------------
  // Load vehicle
  // -----------------------------
  load(): void {
    if (!this.id) {
      this.error.set('ID véhicule manquant dans l’URL');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.svc.getById(this.id).subscribe({
      next: (v) => {
        this.vehicle.set(v);
        this.loading.set(false);

        // pré-sélection depot si dispo
        const depotId =
          typeof v.idDepot === 'string'
            ? v.idDepot
            : (v.idDepot && typeof v.idDepot === 'object' && '_id' in v.idDepot ? (v.idDepot as { _id: string })._id : '');

        if (depotId) this.selectedDepotId.set(depotId);

        // charge historique une fois véhicule OK
        this.loadHistory(true);
        this.loadLatestBreakdown();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement véhicule'));
      },
    });
  }

  // -----------------------------
  // Load depots
  // -----------------------------
  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotsError.set(null);

    this.depotSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.depotsLoading.set(false);
        this.depotsError.set(this.apiError(err, 'Erreur chargement dépôts'));
      },
    });
  }

  // -----------------------------
  // Load technicians
  // -----------------------------
  private loadTechnicians(): void {
    this.techniciansLoading.set(true);
    this.techniciansError.set(null);

    this.userSvc.refreshUsers(true, { role: 'TECHNICIEN', page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.technicians.set(res.items ?? []);
        this.techniciansLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.techniciansLoading.set(false);
        this.techniciansError.set(this.apiError(err, 'Erreur chargement techniciens'));
      },
    });
  }

  // -----------------------------
  // History
  // -----------------------------
  loadHistory(forcePageReset = false): void {
    const v = this.vehicle();
    if (!v) return;

    if (forcePageReset) this.historyPage.set(1);

    this.historyLoading.set(true);
    this.historyError.set(null);

    this.svc.history(v._id, this.historyPage(), this.historyLimit()).subscribe({
      next: (r) => {
        this.history.set(r);
        this.historyLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.historyLoading.set(false);
        this.historyError.set(this.apiError(err, 'Erreur chargement historique'));
      },
    });
  }

  loadLatestBreakdown(): void {
    const v = this.vehicle();
    if (!v) return;
    this.breakdownLoading.set(true);
    this.breakdownError.set(null);

    this.svc.breakdowns(v._id, 1, 1).subscribe({
      next: (res) => {
        const latest = res.items?.[0] ?? null;
        this.latestBreakdown.set(latest);
        this.breakdownLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.breakdownLoading.set(false);
        this.breakdownError.set(this.apiError(err, 'Erreur chargement panne'));
      }
    });
  }

  prevHistory(): void {
    if (!this.canPrevHistory()) return;
    this.historyPage.set(this.historyPage() - 1);
    this.loadHistory(false);
  }

  nextHistory(): void {
    if (!this.canNextHistory()) return;
    this.historyPage.set(this.historyPage() + 1);
    this.loadHistory(false);
  }

  setHistoryLimit(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;

    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;

    this.setHistoryLimitValue(v);
  }

  setHistoryLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.historyLimit.set(value);
    this.loadHistory(true);
  }

  // -----------------------------
  // UI events
  // -----------------------------
  onTechSelect(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    this.selectedTechId.set(el.value || '');
  }

  onDepotSelect(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    this.selectedDepotId.set(el.value || '');
  }

  openAssign(): void {
    this.assignMode.set('assign');
    this.actionError.set(null);
    this.selectedTechId.set('');
    this.assignNote.set('');
  }

  openRelease(): void {
    this.assignMode.set('release');
    this.actionError.set(null);
    this.selectedDepotId.set('');
    this.releaseNote.set('');
  }

  closeActions(): void {
    this.assignMode.set('idle');
    this.actionError.set(null);
    this.assignNote.set('');
    this.releaseNote.set('');
  }

  // Si tu as un AuthService, remplace ici par auth.userId()
  authorId(): string | null {
    return null;
  }

  assignToTech(): void {
    const v = this.vehicle();
    const techId = this.selectedTechId();
    if (!v) return;

    if (!techId) {
      this.actionError.set('Veuillez sélectionner un technicien.');
      return;
    }

    this.actionSaving.set(true);
    this.actionError.set(null);

    const payload: AssignVehiclePayload = {
      techId,
      author: this.authorId() ?? undefined,
      note: this.assignNote().trim() || undefined,
    };

    this.svc.assignVehicle(v._id, payload).subscribe({
      next: () => {
        this.actionSaving.set(false);
        this.assignMode.set('idle');
        this.selectedTechId.set('');
        this.assignNote.set('');
        this.load(); // refresh + history refresh
      },
      error: (err: HttpErrorResponse) => {
        this.actionSaving.set(false);
        this.actionError.set(this.apiError(err, 'Erreur assignation véhicule'));
      },
    });
  }

  releaseToDepot(): void {
    const v = this.vehicle();
    if (!v) return;

    const depotId = this.selectedDepotId();
    if (!depotId) {
      this.actionError.set('Veuillez sélectionner un dépôt de retour.');
      return;
    }

    this.actionSaving.set(true);
    this.actionError.set(null);

    const payload: ReleaseVehiclePayload = {
      depotId,
      author: this.authorId() ?? undefined,
      note: this.releaseNote().trim() || undefined,
    };

    this.svc.releaseVehicle(v._id, payload).subscribe({
      next: () => {
        this.actionSaving.set(false);
        this.assignMode.set('idle');
        this.releaseNote.set('');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.actionSaving.set(false);
        this.actionError.set(this.apiError(err, 'Erreur reprise véhicule'));
      },
    });
  }

  onAssignNoteChange(event: Event): void {
    const el = event.target instanceof HTMLTextAreaElement ? event.target : null;
    this.assignNote.set(el?.value ?? '');
  }

  onReleaseNoteChange(event: Event): void {
    const el = event.target instanceof HTMLTextAreaElement ? event.target : null;
    this.releaseNote.set(el?.value ?? '');
  }

  // -----------------------------
  // Timeline rendering helpers
  // -----------------------------
  historyTitle(it: VehicleHistoryItem): string {
    const action = it?.snapshot?.action || it?.attribution?.action || '';
    if (action.includes('ASSIGN')) return 'Assignation véhicule';
    if (action.includes('RELEASE')) return 'Reprise véhicule';

    // fallback sur action Attribution
    if (it?.attribution?.action === 'ATTRIBUTION') return 'Attribution';
    if (it?.attribution?.action === 'REPRISE') return 'Reprise';
    return 'Événement';
  }

  historyWhen(it: VehicleHistoryItem): string | Date | null {
    // priorité snapshot.timestamp, sinon createdAt
    return it?.snapshot?.timestamp ?? it?.createdAt ?? it?.attribution?.createdAt ?? null;
  }

  historyAuthorLabel(it: VehicleHistoryItem): string {
    const a = it?.attribution?.author;
    if (!a) return '—';

    if (typeof a === 'object' && '_id' in a) {
      const u = a as { firstName?: string; lastName?: string; email?: string };
      const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
      return name || u.email || '—';
    }
    return '—';
  }

  historyToUserLabel(it: VehicleHistoryItem): string {
    const u = it?.attribution?.toUser;
    if (!u) return '—';

    if (typeof u === 'object' && '_id' in u) {
      const x = u as { firstName?: string; lastName?: string; email?: string };
      const name = formatPersonName(x.firstName ?? '', x.lastName ?? '');
      return name || x.email || '—';
    }
    return '—';
  }

  historyFromDepotLabel(it: VehicleHistoryItem): string {
    const d = it?.attribution?.fromDepot;
    if (!d) return '—';

    if (typeof d === 'object' && '_id' in d) {
      const x = d as { name?: string; city?: string };
      const base = formatDepotName(x.name) || '—';
      return x.city ? `${base} · ${x.city}` : base;
    }
    return '—';
  }

  historyNote(it: VehicleHistoryItem): string {
    const n = it?.attribution?.note || it?.snapshot?.note;
    return typeof n === 'string' && n.trim() ? n.trim() : '';
  }

  breakdownStatusLabel(): string {
    const b = this.latestBreakdown();
    if (!b) return '—';
    return b.status === 'RESOLVED' ? 'Réparé' : 'Ouvert';
  }

  breakdownReturnDate(): string {
    const b = this.latestBreakdown();
    if (!b?.resolvedAt) return '—';
    return this.datePipe.transform(b.resolvedAt as any, 'short') ?? '—';
  }

  breakdownCost(): string {
    const b = this.latestBreakdown();
    if (b?.resolvedCost == null) return '—';
    return `${b.resolvedCost}`;
  }

  // -----------------------------
  // Errors helper (0 any)
  // -----------------------------
  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }

  edit(): void {
    if (this.isDepotManager() || this.isReadOnly()) return;
    if (!this.id) return;
    this.router.navigate(['/admin/resources/vehicles', this.id, 'edit']).then();
  }

  openBreakdowns(): void {
    if (!this.id) return;
    const base = this.isDepotManager()
      ? '/depot/resources/vehicles'
      : this.isReadOnly()
        ? '/technician/resources/vehicles'
        : '/admin/resources/vehicles';
    this.router.navigate([base, this.id, 'breakdowns']).then();
  }

  declareBreakdown(): void {
    if (!this.id || !this.canDeclareBreakdown()) return;
    const base = this.isDepotManager()
      ? '/depot/resources/vehicles'
      : this.isReadOnly()
        ? '/technician/resources/vehicles'
        : '/admin/resources/vehicles';
    this.router.navigate([base, this.id, 'breakdown']).then();
  }
}
