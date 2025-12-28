// src/app/admin/resources/vehicles/vehicle-detail/vehicle-detail.ts
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { VehicleService, AssignVehiclePayload, ReleaseVehiclePayload } from '../../../../core/services/vehicle.service';
import { DepotService } from '../../../../core/services/depot.service';
import { UserService } from '../../../../core/services/user.service';

import { Vehicle, Depot, User } from '../../../../core/models';
import { VehicleHistoryItem, VehicleHistoryResult } from '../../../../core/models/vehicle-history.model';
import {DetailBack} from '../../../../core/utils/detail-back';

type AssignMode = 'idle' | 'assign' | 'release';

@Component({
  standalone: true,
  selector: 'app-vehicle-detail',
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './vehicle-detail.html',
  styleUrls: ['./vehicle-detail.scss'],
})
export class VehicleDetail extends DetailBack {
  private svc = inject(VehicleService);
  private depotSvc = inject(DepotService);
  private userSvc = inject(UserService);
  private route = inject(ActivatedRoute);

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

  // -----------------------------
  // History (timeline)
  // -----------------------------
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly history = signal<VehicleHistoryResult | null>(null);

  readonly historyPage = signal(1);
  readonly historyLimit = signal(10);

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
  // Derived
  // -----------------------------
  readonly isAssigned = computed(() => {
    const v = this.vehicle();
    return !!v?.assignedTo;
  });

  readonly statusLabel = computed(() => (this.isAssigned() ? 'Assigné' : 'Disponible'));

  constructor() {
    super();
    this.loadDepots();
    this.loadTechnicians();
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
      return obj.name ?? '—';
    }

    return '—';
  }

  assignedToLabel(): string {
    const v = this.vehicle();
    if (!v || !v.assignedTo) return '—';

    const a = v.assignedTo;
    if (typeof a === 'object' && '_id' in a) {
      const u = a as { _id: string; firstName?: string; lastName?: string; email?: string };
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
      return name || u.email || '—';
    }

    return '—';
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

    this.historyLimit.set(v);
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
  }

  openRelease(): void {
    this.assignMode.set('release');
    this.actionError.set(null);
  }

  closeActions(): void {
    this.assignMode.set('idle');
    this.actionError.set(null);
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
    };

    this.svc.assignVehicle(v._id, payload).subscribe({
      next: () => {
        this.actionSaving.set(false);
        this.assignMode.set('idle');
        this.selectedTechId.set('');
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
    };

    this.svc.releaseVehicle(v._id, payload).subscribe({
      next: () => {
        this.actionSaving.set(false);
        this.assignMode.set('idle');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.actionSaving.set(false);
        this.actionError.set(this.apiError(err, 'Erreur reprise véhicule'));
      },
    });
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
      const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
      return name || u.email || '—';
    }
    return '—';
  }

  historyToUserLabel(it: VehicleHistoryItem): string {
    const u = it?.attribution?.toUser;
    if (!u) return '—';

    if (typeof u === 'object' && '_id' in u) {
      const x = u as { firstName?: string; lastName?: string; email?: string };
      const name = `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim();
      return name || x.email || '—';
    }
    return '—';
  }

  historyFromDepotLabel(it: VehicleHistoryItem): string {
    const d = it?.attribution?.fromDepot;
    if (!d) return '—';

    if (typeof d === 'object' && '_id' in d) {
      const x = d as { name?: string; city?: string };
      const base = x.name ?? '—';
      return x.city ? `${base} · ${x.city}` : base;
    }
    return '—';
  }

  historyNote(it: VehicleHistoryItem): string {
    const n = it?.attribution?.note || it?.snapshot?.note;
    return typeof n === 'string' && n.trim() ? n.trim() : '';
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
    if (!this.id) return;
    this.router.navigate(['/admin/resources/vehicles', this.id, 'edit']).then();
  }
}
