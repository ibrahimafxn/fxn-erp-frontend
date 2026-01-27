import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { MovementService } from '../../../core/services/movement.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/models/roles.model';
import { Consumable, Depot, Movement, MovementListResult, User } from '../../../core/models';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { downloadBlob } from '../../../core/utils/download';
import { ConfirmCancelModal } from '../../../shared/components/dialog/confirm-cancel-modal/confirm-cancel-modal';

@Component({
  selector: 'app-reservations-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  providers: [DatePipe],
  imports: [CommonModule, ReactiveFormsModule, ConfirmCancelModal],
  templateUrl: './reservations-list.html',
  styleUrl: './reservations-list.scss',
})
export class ReservationsList {
  private movementService = inject(MovementService);
  private consumableService = inject(ConsumableService);
  private userService = inject(UserService);
  private depotService = inject(DepotService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private datePipe = inject(DatePipe);

  readonly loading = this.movementService.loading;
  readonly error = this.movementService.error;
  readonly result: Signal<MovementListResult | null> = this.movementService.result;

  readonly page = signal(1);
  readonly limit = signal(25);

  readonly users = signal<User[]>([]);
  readonly depots = signal<Depot[]>([]);
  readonly consumables = signal<Consumable[]>([]);
  readonly authorCache = signal<Record<string, User>>({});
  private authorLoading = new Set<string>();
  private authorDenied = new Set<string>();
  readonly rowActionLoading = signal<Record<string, boolean>>({});
  readonly rowActionError = signal<Record<string, string>>({});
  readonly rowCancelLoading = signal<Record<string, boolean>>({});
  readonly rowCancelError = signal<Record<string, string>>({});
  readonly cancelModalOpen = signal(false);
  readonly cancelTarget = signal<Movement | null>(null);
  readonly usersLoading = signal(false);
  readonly depotsLoading = signal(false);
  readonly consumablesLoading = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    resourceId: this.fb.nonNullable.control(''),
    toUser: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly managerDepotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) return String((raw as { _id: string })._id);
    return null;
  });

  readonly items = computed<Movement[]>(() => this.result()?.items ?? []);
  readonly assignedByTech = signal<Record<string, number>>({});
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly technicians = computed(() =>
    this.users().filter((u) => u.role === Role.TECHNICIEN)
  );

  readonly showDepotFilter = computed(() => !this.isDepotManager());
  private readonly currentConsumableDepot = signal<string | null>(null);

  constructor() {
    this.loadUsers();
    this.loadDepots();
    this.loadConsumables(this.isDepotManager() ? this.managerDepotId() : null);
    this.refresh(true);
  }

  refresh(force = false): void {
    const f = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(f.fromDate, f.toDate);
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);
    this.loadConsumables(depotId || null);
    this.movementService.refresh(force, {
      resourceType: 'CONSUMABLE',
      resourceId: f.resourceId || undefined,
      action: 'ASSIGN',
      toType: 'USER',
      toId: f.toUser || undefined,
      depotId: depotId || undefined,
      fromDate: dates.fromDate,
      toDate: dates.toDate,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        this.assignedByTech.set(this.computeAssignedByTechnician(res.items ?? []));
      },
      error: () => {}
    });
  }

  exportCsv(): void {
    const f = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(f.fromDate, f.toDate);
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);
    this.movementService.exportCsv({
      resourceType: 'CONSUMABLE',
      resourceId: f.resourceId || undefined,
      action: 'ASSIGN',
      toType: 'USER',
      toId: f.toUser || undefined,
      depotId: depotId || undefined,
      fromDate: dates.fromDate,
      toDate: dates.toDate
    }).subscribe({
      next: (blob) => downloadBlob(blob, `attributions-consommables-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => {}
    });
  }

  exportPdf(): void {
    const f = this.filterForm.getRawValue();
    const dates = this.normalizeDateRange(f.fromDate, f.toDate);
    const depotId = this.isDepotManager() ? this.managerDepotId() : (f.depot || undefined);
    this.movementService.exportPdf({
      resourceType: 'CONSUMABLE',
      resourceId: f.resourceId || undefined,
      action: 'ASSIGN',
      toType: 'USER',
      toId: f.toUser || undefined,
      depotId: depotId || undefined,
      fromDate: dates.fromDate,
      toDate: dates.toDate
    }).subscribe({
      next: (blob) => downloadBlob(blob, `attributions-consommables-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => {}
    });
  }

  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({
      resourceId: '',
      toUser: '',
      depot: '',
      fromDate: '',
      toDate: ''
    });
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

  resourceLabel(m: Movement): string {
    const id = m.resourceId || '';
    if (!id) return '—';
    const found = this.consumables().find((c) => c._id === id);
    if (found?.name) return found.name;
    return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
  }

  consumableOptionLabel(c: Consumable): string {
    const name = c.name || '—';
    const unit = c.unit ? ` · ${c.unit}` : '';
    return `${name}${unit}`;
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
    if (!depot) return this.shortId(id);
    const name = formatDepotName(depot.name) || depot.name;
    return depot.city ? `${name} · ${depot.city}` : name;
  }

  authorLabel(m: Movement): string {
    const authorId = m.author;
    const anyMovement = m as Movement & { authorName?: string; authorEmail?: string };
    if (anyMovement.authorName) return anyMovement.authorName;
    if (anyMovement.authorEmail) return anyMovement.authorEmail;
    if (!authorId) return '—';
    const user = this.users().find((u) => u._id === authorId) || this.authorCache()[authorId];
    if (!user) this.ensureUserLoaded(authorId);
    if (!user) return this.shortId(authorId);
    const name = formatPersonName(user.firstName ?? '', user.lastName ?? '');
    return name || user.email || user._id;
  }

  actionLabel(action?: Movement['action']): string {
    switch (action) {
      case 'ASSIGN': return 'Attribution';
      case 'RELEASE': return 'Reprise';
      case 'IN': return 'Entrée';
      case 'OUT': return 'Sortie';
      case 'TRANSFER': return 'Transfert';
      case 'ADJUST': return 'Ajustement';
      case 'CREATE': return 'Création';
      case 'UPDATE': return 'Mise à jour';
      case 'DELETE': return 'Suppression';
      default: return action || '—';
    }
  }

  canRelease(m: Movement): boolean {
    return m.action === 'ASSIGN'
      && !!m.resourceId
      && !!m.to?.id
      && !!m.from?.id;
  }

  canCancel(m: Movement): boolean {
    return m.status !== 'CANCELED' && m.action === 'ASSIGN';
  }

  releaseFromRow(m: Movement): void {
    if (!this.canRelease(m)) return;
    const ok = window.confirm("Confirmer la reprise de cette attribution ?");
    if (!ok) return;

    this.setRowActionLoading(m._id, true);
    this.setRowActionError(m._id, '');

    this.consumableService.releaseReservation({
      consumableId: m.resourceId,
      qty: Number(m.quantity),
      toUser: m.to?.id,
      fromDepot: m.from?.id,
      note: m.note || null
    }).subscribe({
      next: () => {
        this.setRowActionLoading(m._id, false);
        this.refresh(true);
      },
      error: (err: HttpErrorResponse) => {
        this.setRowActionLoading(m._id, false);
        this.setRowActionError(m._id, this.apiError(err, 'Erreur reprise'));
      }
    });
  }

  cancelFromRow(m: Movement): void {
    if (!this.canCancel(m)) return;
    this.cancelTarget.set(m);
    this.cancelModalOpen.set(true);
  }

  closeCancelModal(): void {
    this.cancelModalOpen.set(false);
    this.cancelTarget.set(null);
  }

  confirmCancel(reason: string): void {
    const m = this.cancelTarget();
    if (!m) return;
    this.setRowCancelLoading(m._id, true);
    this.setRowCancelError(m._id, '');

    this.movementService.cancel(m._id, reason || '').subscribe({
      next: () => {
        this.setRowCancelLoading(m._id, false);
        this.closeCancelModal();
        this.refresh(true);
      },
      error: (err: HttpErrorResponse) => {
        this.setRowCancelLoading(m._id, false);
        this.setRowCancelError(m._id, this.apiError(err, 'Erreur annulation'));
        this.closeCancelModal();
      }
    });
  }

  createdAtText(m: Movement): string {
    return this.datePipe.transform(m.createdAt as any, 'short') ?? '—';
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

  rowError(m: Movement): string {
    return this.rowActionError()[m._id] || '';
  }

  cancelError(m: Movement): string {
    return this.rowCancelError()[m._id] || '';
  }

  assignedForTech(id?: string | null): number {
    if (!id) return 0;
    return this.assignedByTech()[id] ?? 0;
  }

  private loadUsers(): void {
    this.usersLoading.set(true);
    this.userService.refreshUsers(true, {
      page: 1,
      limit: 500,
      depot: this.isDepotManager() ? this.managerDepotId() ?? undefined : undefined
    }).subscribe({
      next: (res) => {
        this.users.set(res.items ?? []);
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false)
    });
  }

  private loadDepots(): void {
    if (this.isDepotManager()) {
      const depotId = this.managerDepotId();
      if (!depotId) {
        this.depots.set([]);
        return;
      }
      this.depotsLoading.set(true);
      this.depotService.getDepot(depotId).subscribe({
        next: (depot) => {
          this.depots.set([depot]);
          this.depotsLoading.set(false);
        },
        error: () => this.depotsLoading.set(false)
      });
      return;
    }
    this.depotsLoading.set(true);
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false)
    });
  }

  private loadConsumables(depotId: string | null): void {
    if (depotId && this.currentConsumableDepot() === depotId && this.consumables().length > 0) return;
    if (!depotId && this.currentConsumableDepot() === null && this.consumables().length > 0) return;

    this.currentConsumableDepot.set(depotId);
    this.consumablesLoading.set(true);

    this.consumableService.refresh(true, { page: 1, limit: 500, depot: depotId || undefined }).subscribe({
      next: (res) => {
        this.consumables.set(res.items ?? []);
        this.consumablesLoading.set(false);
      },
      error: () => this.consumablesLoading.set(false)
    });
  }

  private setRowActionLoading(id: string, state: boolean): void {
    this.rowActionLoading.set({ ...this.rowActionLoading(), [id]: state });
  }

  private setRowActionError(id: string, message: string): void {
    this.rowActionError.set({ ...this.rowActionError(), [id]: message });
  }

  private setRowCancelLoading(id: string, state: boolean): void {
    this.rowCancelLoading.set({ ...this.rowCancelLoading(), [id]: state });
  }

  private setRowCancelError(id: string, message: string): void {
    this.rowCancelError.set({ ...this.rowCancelError(), [id]: message });
  }

  private shortId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
  }

  private ensureUserLoaded(id: string): void {
    if (!id || this.authorLoading.has(id)) return;
    if (this.users().some((u) => u._id === id)) return;
    if (this.authorCache()[id]) return;
    if (this.authorDenied.has(id)) return;

    this.authorLoading.add(id);
    this.userService.getUser(id).subscribe({
      next: (user) => {
        this.authorCache.set({ ...this.authorCache(), [id]: user });
        this.authorLoading.delete(id);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403 || err.status === 404) this.authorDenied.add(id);
        this.authorLoading.delete(id);
      }
    });
  }

  private normalizeDateRange(fromDate: string, toDate: string): { fromDate?: string; toDate?: string } {
    const from = fromDate ? `${fromDate}T00:00:00` : '';
    const to = toDate ? `${toDate}T23:59:59.999` : '';
    return {
      fromDate: from || undefined,
      toDate: to || undefined
    };
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }

  private computeAssignedByTechnician(items: Movement[]): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const m of items) {
      if (!m?.to?.id) continue;
      const qty = Number(m.quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (m.action !== 'ASSIGN' && m.action !== 'RELEASE') continue;
      const delta = m.action === 'RELEASE' ? -qty : qty;
      totals[m.to.id] = (totals[m.to.id] || 0) + delta;
    }
    return totals;
  }
}
