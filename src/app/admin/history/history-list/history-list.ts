import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { MovementService } from '../../../core/services/movement.service';
import { DepotService } from '../../../core/services/depot.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/models/roles.model';
import { Depot, Movement, MovementListResult, User } from '../../../core/models';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';

@Component({
  selector: 'app-history-list',
  standalone: true,
  providers: [DatePipe],
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './history-list.html',
  styleUrl: './history-list.scss',
})
export class HistoryList {
  private movementService = inject(MovementService);
  private depotService = inject(DepotService);
  private userService = inject(UserService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private datePipe = inject(DatePipe);

  readonly loading = this.movementService.loading;
  readonly error = this.movementService.error;
  readonly result: Signal<MovementListResult | null> = this.movementService.result;

  readonly page = signal(1);
  readonly limit = signal(25);

  readonly depots = signal<Depot[]>([]);
  readonly users = signal<User[]>([]);
  readonly depotsLoading = signal(false);
  readonly usersLoading = signal(false);

  readonly filterForm = this.fb.nonNullable.group({
    resourceType: this.fb.nonNullable.control(''),
    action: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control(''),
    resourceId: this.fb.nonNullable.control(''),
    fromType: this.fb.nonNullable.control(''),
    fromId: this.fb.nonNullable.control(''),
    toType: this.fb.nonNullable.control(''),
    toId: this.fb.nonNullable.control(''),
  });

  readonly items = computed<Movement[]>(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly managerDepotId = computed(() => {
    const raw = this.auth.getCurrentUser()?.idDepot ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && '_id' in raw) return String((raw as { _id: string })._id);
    return null;
  });

  constructor() {
    this.loadDepots();
    this.loadUsers();
    this.refresh(true);
  }

  refresh(force = false): void {
    const f = this.filterForm.getRawValue();
    const depotId = this.isDepotManager() ? this.managerDepotId() : null;
    this.movementService.refresh(force, {
      resourceType: f.resourceType || undefined,
      action: f.action || undefined,
      status: f.status || undefined,
      depotId: depotId || undefined,
      resourceId: f.resourceId.trim() || undefined,
      fromType: f.fromType || undefined,
      fromId: f.fromId.trim() || undefined,
      toType: f.toType || undefined,
      toId: f.toId.trim() || undefined,
      page: this.page(),
      limit: this.limit(),
    }).subscribe({ error: () => {} });
  }

  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({
      resourceType: '',
      action: '',
      status: '',
      resourceId: '',
      fromType: '',
      fromId: '',
      toType: '',
      toId: '',
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

  endpointLabel(type: string, id: string | null | undefined): string {
    if (!id) return '—';
    if (type === 'DEPOT') {
      const depot = this.depots().find((d) => d._id === id);
      if (depot) {
        const name = formatDepotName(depot.name) || depot.name;
        return `${name}${depot.city ? ' · ' + depot.city : ''}`;
      }
    }
    if (type === 'USER') {
      const user = this.users().find((u) => u._id === id);
      if (user) {
        const name = formatPersonName(user.firstName ?? '', user.lastName ?? '');
        return name || user.email || id;
      }
    }
    const short = id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
    return `${type}:${short}`;
  }

  resourceLabel(m: Movement): string {
    return m.resourceType;
  }

  actionLabel(action: string): string {
    switch (action) {
      case 'IN': return 'Entrée';
      case 'OUT': return 'Sortie';
      case 'TRANSFER': return 'Transfert';
      case 'ASSIGN': return 'Attribution';
      case 'RELEASE': return 'Reprise';
      case 'ADJUST': return 'Ajustement';
      default: return action;
    }
  }

  statusLabel(status: string): string {
    return status === 'CANCELED' ? 'Annulé' : 'Validé';
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

  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  private loadUsers(): void {
    this.usersLoading.set(true);
    this.userService.refreshUsers(true, { page: 1, limit: 300 }).subscribe({
      next: (res) => {
        this.users.set(res.items ?? []);
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false),
    });
  }

  userLabel(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || u._id;
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }
}
