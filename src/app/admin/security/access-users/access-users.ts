import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { Depot, User, Vehicle } from '../../../core/models';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';

import { AccessCredentialsModal } from '../../../shared/ui/access-credentials-modal/access-credentials-modal';
import {ConfirmDeleteModal} from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

/**
 * ✅ Gestion des accès de connexion :
 * - activer l’accès (définir mdp)
 * - reset mdp
 * - désactiver l’accès
 *
 * UX : badges de statut, actions claires, modal + confirm.
 */
@Component({
  standalone: true,
  selector: 'app-access-users',
  providers: [DatePipe],
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    AccessCredentialsModal,
    ConfirmDeleteModal,
  ],
  templateUrl: './access-users.html',
  styleUrls: ['./access-users.scss'],
})
export class AccessUsers {
  private fb = inject(FormBuilder);
  private usersSvc = inject(UserService);
  private depotSvc = inject(DepotService);
  private vehicleSvc = inject(VehicleService);
  private datePipe = inject(DatePipe);

  // ✅ list users (tu as déjà refreshUsers/result/loading/error dans ton app)
  readonly loading = this.usersSvc.loading;
  readonly error = this.usersSvc.error;
  readonly result: Signal<any | null> = this.usersSvc.result; // ton UserListResult

  // pagination
  readonly page = signal(1);
  readonly limit = signal(25);

  readonly items = computed<User[]>(() => this.result()?.items ?? []);
  readonly noAccessCount = computed(() => this.items().filter(u => !u.authEnabled).length);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  // depots + vehicles pour labels
  readonly depots = signal<Depot[]>([]);
  readonly vehicles = signal<Vehicle[]>([]);

  // filtres
  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    role: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
    onlyNoAccess: this.fb.nonNullable.control(false),
  });

  // modal enable/reset
  readonly credOpen = signal(false);
  readonly credMode = signal<'enable' | 'reset'>('enable');
  readonly selectedUser = signal<User | null>(null);
  readonly credSaving = signal(false);
  readonly credError = signal<string | null>(null);

  // confirm disable access (on réutilise ton ConfirmDeleteModal)
  readonly disableOpen = signal(false);
  readonly disableSaving = signal(false);
  readonly pendingDisableUser = signal<User | null>(null);

  constructor() {
    this.loadDepots();
    this.loadVehicles();
    this.refresh(true);
  }

  refresh(force = false): void {
    const f = this.filterForm.getRawValue();

    this.usersSvc.refreshUsers(force, {
      q: f.q.trim() || undefined,
      role: f.role || undefined,
      depot: f.depot || undefined,
      page: this.page(),
      limit: this.limit(),
    }).subscribe({ error: () => {} });
  }

  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({ q: '', role: '', depot: '', onlyNoAccess: false });
    this.page.set(1);
    this.refresh(true);
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh(true);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.refresh(true);
  }

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;

    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;

    this.limit.set(v);
    this.page.set(1);
    this.refresh(true);
  }

  /** UX: filtre front “sans accès” */
  visibleItems = computed(() => {
    const onlyNoAccess = this.filterForm.controls.onlyNoAccess.value;
    const list = this.items();
    if (!onlyNoAccess) return list;
    return list.filter(u => !u.authEnabled);
  });

  // -----------------------------
  // Labels
  // -----------------------------
  userLabel(u: User): string {
    return formatPersonName(u.firstName ?? '', u.lastName ?? '') || u.email || u._id;
  }

  depotLabel(u: User): string {
    const d: any = (u as any).idDepot;
    if (!d) return '—';
    if (typeof d === 'object' && '_id' in d) return formatDepotName(d.name) || '—';
    if (typeof d === 'string') {
      const name = this.depots().find(x => x._id === d)?.name ?? '';
      return formatDepotName(name) || '—';
    }
    return '—';
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }

  vehicleLabel(u: User): string {
    const v: any = (u as any).assignedVehicle;
    if (!v) return '—';
    if (typeof v === 'object' && '_id' in v) {
      const plate = v.plateNumber ?? '—';
      const txt = `${v.brand ?? ''} ${v.model ?? ''}`.trim();
      return `${plate}${txt ? ' · ' + txt : ''}`;
    }
    if (typeof v === 'string') {
      const found = this.vehicles().find(x => x._id === v);
      if (!found) return '—';
      const txt = `${found.brand ?? ''} ${found.model ?? ''}`.trim();
      return `${found.plateNumber ?? '—'}${txt ? ' · ' + txt : ''}`;
    }
    return '—';
  }

  lastLoginText(u: User): string {
    const dt = u.lastLoginAt ?? null;
    return dt ? (this.datePipe.transform(dt as any, 'short') ?? '—') : '—';
  }

  accessBadge(u: User): 'ACTIVE' | 'DISABLED' | 'MUST_CHANGE' {
    if (!u.authEnabled) return 'DISABLED';
    if (u.mustChangePassword) return 'MUST_CHANGE';
    return 'ACTIVE';
  }

  // -----------------------------
  // Modal enable/reset
  // -----------------------------
  openEnable(u: User): void {
    this.selectedUser.set(u);
    this.credMode.set('enable');
    this.credError.set(null);
    this.credOpen.set(true);
  }

  openReset(u: User): void {
    this.selectedUser.set(u);
    this.credMode.set('reset');
    this.credError.set(null);
    this.credOpen.set(true);
  }

  closeCred(): void {
    this.credOpen.set(false);
    this.selectedUser.set(null);
    this.credSaving.set(false);
    this.credError.set(null);
  }

  confirmCred(payload: { password: string; mustChangePassword: boolean }): void {
    const u = this.selectedUser();
    if (!u) return;

    this.credSaving.set(true);
    this.credError.set(null);

    const call$ =
      this.credMode() === 'reset'
        ? this.usersSvc.resetPassword(u._id, payload)
        : this.usersSvc.setAccess(u._id, payload);

    call$.subscribe({
      next: () => {
        this.credSaving.set(false);
        this.closeCred();
        this.refresh(true);
      },
      error: (err: HttpErrorResponse) => {
        this.credSaving.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.credError.set(apiMsg || err.message || 'Erreur accès');
      },
    });
  }

  // -----------------------------
  // Disable access (confirm modal)
  // -----------------------------
  openDisable(u: User): void {
    this.pendingDisableUser.set(u);
    this.disableOpen.set(true);
  }

  closeDisable(): void {
    this.disableOpen.set(false);
    this.pendingDisableUser.set(null);
    this.disableSaving.set(false);
  }

  confirmDisable(): void {
    const u = this.pendingDisableUser();
    if (!u) return;

    this.disableSaving.set(true);

    this.usersSvc.disableAccess(u._id).subscribe({
      next: () => {
        this.disableSaving.set(false);
        this.closeDisable();
        this.refresh(true);
      },
      error: () => {
        this.disableSaving.set(false);
        this.closeDisable();
      }
    });
  }

  // -----------------------------
  // load deps
  // -----------------------------
  private loadDepots(): void {
    this.depotSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => this.depots.set(res.items ?? []),
      error: () => this.depots.set([]),
    });
  }

  private loadVehicles(): void {
    this.vehicleSvc.refresh(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => this.vehicles.set(res.items ?? []),
      error: () => this.vehicles.set([]),
    });
  }

  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  /** Récupère checked de façon safe (sans logique dans HTML) */
  onOnlyNoAccessChange(event: Event): void {
    const el = event.target as HTMLInputElement | null;
    const checked = !!el?.checked;
    this.filterForm.controls.onlyNoAccess.setValue(checked);
  }

  /** (optionnel) si tu as d'autres checkbox filtres */
  onBoolControlChange(event: Event, controlName: 'onlyNoAccess'): void {
    const el = event.target as HTMLInputElement | null;
    this.filterForm.controls[controlName].setValue(!!el?.checked);
  }

  trackById = (_: number, u: User) => u._id;
  protected readonly HTMLInputElement = HTMLInputElement;
}
