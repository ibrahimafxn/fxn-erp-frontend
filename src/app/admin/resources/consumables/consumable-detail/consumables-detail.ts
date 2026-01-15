import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ConsumableService } from '../../../../core/services/consumable.service';
import { DepotService } from '../../../../core/services/depot.service';
import { MovementService } from '../../../../core/services/movement.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AttributionHistoryItem, AttributionHistoryResult, Consumable, Depot, User } from '../../../../core/models';
import { DetailBack } from '../../../../core/utils/detail-back';
import { formatDepotName, formatPersonName, formatResourceName } from '../../../../core/utils/text-format';
import { downloadBlob } from '../../../../core/utils/download';
import { Role } from '../../../../core/models/roles.model';
import { ConfirmDeleteModal } from '../../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  selector: 'app-consumable-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './consumables-detail.html',
  styleUrl: './consumables-detail.scss',
})
export class ConsumablesDetail extends DetailBack {
  private fb = inject(FormBuilder);
  private svc = inject(ConsumableService);
  private depotSvc = inject(DepotService);
  private movementSvc = inject(MovementService);
  private userSvc = inject(UserService);
  private authSvc = inject(AuthService);
  private route = inject(ActivatedRoute);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly consumable = signal<Consumable | null>(null);
  readonly depot = signal<Depot | null>(null);

  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly history = signal<AttributionHistoryResult | null>(null);

  readonly historyPage = signal(1);
  readonly historyLimit = signal(10);
  readonly historyItems = computed<AttributionHistoryItem[]>(() => this.history()?.items ?? []);
  readonly historyTotal = computed(() => this.history()?.total ?? 0);
  readonly historyPageCount = computed(() => {
    const t = this.historyTotal();
    const l = this.historyLimit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrevHistory = computed(() => this.historyPage() > 1);
  readonly canNextHistory = computed(() => this.historyPage() < this.historyPageCount());
  readonly isDepotManager = computed(() => this.authSvc.getUserRole() === Role.GESTION_DEPOT);

  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');
  readonly deleting = signal(false);

  readonly availableQty = computed(() => {
    const c = this.consumable();
    if (!c) return 0;
    const total = c.quantity ?? 0;
    const assigned = c.assignedQuantity ?? 0;
    return Math.max(0, total - assigned);
  });

  readonly canReserve = computed(() =>
    this.authSvc.hasRole([Role.ADMIN, Role.DIRIGEANT, Role.GESTION_DEPOT])
  );

  readonly technicians = signal<User[]>([]);
  readonly techniciansLoading = signal(false);
  readonly techniciansError = signal<string | null>(null);
  readonly assignedByTech = signal<Record<string, number>>({});

  readonly reserveLoading = signal(false);
  readonly reserveError = signal<string | null>(null);
  readonly reserveSuccess = signal<string | null>(null);
  readonly releaseLoading = signal(false);
  readonly releaseError = signal<string | null>(null);
  readonly releaseSuccess = signal<string | null>(null);

  readonly reserveForm = this.fb.nonNullable.group({
    toUser: this.fb.nonNullable.control('', [Validators.required]),
    qty: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
    note: this.fb.nonNullable.control('')
  });

  constructor() {
    super();
    this.load();
    this.loadHistory(true);
  }

  load(): void {
    if (!this.id) return;
    this.loading.set(true);
    this.error.set(null);
    this.svc.getById(this.id).subscribe({
      next: (c) => {
        this.consumable.set(c);
        this.depot.set(null);
        const depotId = this.depotIdValue(c);
        if (depotId && typeof c.idDepot === 'string') {
          this.depotSvc.getDepot(depotId).subscribe({
            next: (d) => this.depot.set(d),
            error: () => this.depot.set(null)
          });
        }
        this.assignedByTech.set(this.computeAssignedByTechnician());
        this.loadTechnicians(this.depotIdValue(c));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement consommable'));
      }
    });
  }

  loadHistory(forcePageReset = false): void {
    if (!this.id) return;
    if (forcePageReset) this.historyPage.set(1);
    this.historyLoading.set(true);
    this.historyError.set(null);

    this.svc.history(this.id, this.historyPage(), this.historyLimit()).subscribe({
      next: (res) => {
        this.history.set(res);
        this.assignedByTech.set(this.computeAssignedByTechnician());
        this.historyLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.historyLoading.set(false);
        this.historyError.set(this.apiError(err, 'Erreur chargement historique'));
      }
    });
  }

  refresh(): void {
    this.load();
    this.loadHistory(true);
  }

  edit(): void {
    const c = this.consumable();
    if (!c?._id || this.isDepotManager()) return;
    this.router.navigate(['/admin/resources/consumables', c._id, 'edit']).then();
  }

  openDeleteModal(): void {
    if (this.isDepotManager()) return;
    const c = this.consumable();
    if (!c?._id) return;
    this.pendingDeleteId.set(c._id);
    this.pendingDeleteName.set(this.consumableName());
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
  }

  confirmDelete(): void {
    if (this.isDepotManager()) return;
    const id = this.pendingDeleteId();
    if (!id) return;
    this.deleteModalOpen.set(false);
    this.deleting.set(true);

    this.svc.remove(id).subscribe({
      next: () => {
        this.deleting.set(false);
        const fallback = this.isDepotManager() ? '/depot/resources/consumables' : '/admin/resources/consumables';
        this.back(fallback);
      },
      error: () => {
        this.deleting.set(false);
      }
    });
  }

  // Export PDF des mouvements (entrées/sorties) liés à la ressource.
  exportPdf(): void {
    if (!this.id) return;
    this.movementSvc.exportPdf({
      resourceType: 'CONSUMABLE',
      resourceId: this.id
    }).subscribe({
      next: (blob) => downloadBlob(blob, `consumables-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => {}
    });
  }

  exportCsv(): void {
    if (!this.id) return;
    this.movementSvc.exportCsv({
      resourceType: 'CONSUMABLE',
      resourceId: this.id
    }).subscribe({
      next: (blob) => downloadBlob(blob, `consumables-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => {}
    });
  }

  prevHistory(): void {
    if (!this.canPrevHistory()) return;
    this.historyPage.set(this.historyPage() - 1);
    this.loadHistory();
  }

  nextHistory(): void {
    if (!this.canNextHistory()) return;
    this.historyPage.set(this.historyPage() + 1);
    this.loadHistory();
  }

  setHistoryLimit(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.historyLimit.set(v);
    this.loadHistory(true);
  }

  actionLabel(action?: string): string {
    switch (action) {
      case 'AJOUT': return 'Ajout';
      case 'SORTIE': return 'Sortie';
      case 'PERTE': return 'Perte';
      case 'ATTRIBUTION': return 'Attribution';
      case 'REPRISE': return 'Reprise';
      default: return action || '—';
    }
  }

  authorLabel(item: AttributionHistoryItem): string {
    const a = item?.attribution?.author;
    if (!a) return '—';
    if (typeof a === 'string') return this.shortId(a);
    const name = formatPersonName(a.firstName ?? '', a.lastName ?? '');
    return name || a.email || this.shortId(a._id);
  }

  toUserLabel(item: AttributionHistoryItem): string {
    const u = item?.attribution?.toUser;
    if (!u) return '—';
    if (typeof u === 'string') return this.shortId(u);
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || this.shortId(u._id);
  }

  depotLabel(item: AttributionHistoryItem): string {
    const d = item?.attribution?.fromDepot;
    if (!d) return '—';
    if (typeof d === 'string') return this.shortId(d);
    const name = formatDepotName(d.name ?? '') || this.shortId(d._id);
    return d.city ? `${name} · ${d.city}` : name;
  }

  noteLabel(item: AttributionHistoryItem): string {
    const note = item?.attribution?.note ?? item?.note;
    return typeof note === 'string' && note.trim() ? note.trim() : '—';
  }

  createdAtValue(item: AttributionHistoryItem): string | Date | null {
    return item?.attribution?.createdAt ?? item?.createdAt ?? null;
  }

  depotName(): string {
    const d = this.consumable()?.idDepot;
    if (!d) return '—';
    if (typeof d === 'object' && '_id' in d) return formatDepotName(d.name) || '—';
    const fallback = this.depot();
    return fallback ? (formatDepotName(fallback.name ?? '') || '—') : '—';
  }

  consumableName(): string {
    return formatResourceName(this.consumable()?.name ?? '') || '—';
  }

  unitLabel(): string {
    return this.consumable()?.unit || '—';
  }

  technicianLabel(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name ? `${name} · ${u.email}` : u.email;
  }

  assignedForSelectedTech(): number {
    const techId = this.reserveForm.controls.toUser.value;
    if (!techId) return 0;
    return this.assignedByTech()[techId] ?? 0;
  }

  submitReserve(): void {
    if (!this.reserveForm.valid || !this.id) {
      this.reserveForm.markAllAsTouched();
      return;
    }

    const available = this.availableQty();
    const qty = Number(this.reserveForm.controls.qty.value);
    if (!Number.isFinite(qty) || qty <= 0) {
      this.reserveError.set('Quantité invalide.');
      return;
    }
    if (available <= 0 || qty > available) {
      this.reserveError.set('Stock insuffisant pour cette réservation.');
      return;
    }

    const currentUser = this.authSvc.getCurrentUser();
    const noteValue = this.reserveForm.controls.note.value.trim();
    const payload = {
      consumableId: this.id,
      qty,
      toUser: this.reserveForm.controls.toUser.value,
      fromDepot: this.depotIdValue(this.consumable()),
      author: currentUser?._id ?? null,
      note: noteValue ? noteValue : null
    };

    this.reserveLoading.set(true);
    this.reserveError.set(null);
    this.reserveSuccess.set(null);
    this.releaseError.set(null);
    this.releaseSuccess.set(null);

    this.svc.reserve(payload).subscribe({
      next: () => {
        this.reserveLoading.set(false);
        this.reserveSuccess.set('Réservation effectuée.');
        this.reserveForm.reset({ toUser: '', qty: 1, note: '' });
        this.load();
        this.loadHistory(true);
      },
      error: (err: HttpErrorResponse) => {
        this.reserveLoading.set(false);
        this.reserveError.set(this.apiError(err, 'Erreur réservation consommable'));
      }
    });
  }

  submitRelease(): void {
    if (!this.reserveForm.valid || !this.id) {
      this.reserveForm.markAllAsTouched();
      return;
    }

    const qty = Number(this.reserveForm.controls.qty.value);
    if (!Number.isFinite(qty) || qty <= 0) {
      this.releaseError.set('Quantité invalide.');
      return;
    }
    const assignedForTech = this.assignedForSelectedTech();
    if (assignedForTech <= 0 || qty > assignedForTech) {
      this.releaseError.set('Quantité supérieure au stock attribué à ce technicien.');
      return;
    }

    const currentUser = this.authSvc.getCurrentUser();
    const noteValue = this.reserveForm.controls.note.value.trim();
    const payload = {
      consumableId: this.id,
      qty,
      toUser: this.reserveForm.controls.toUser.value,
      fromDepot: this.depotIdValue(this.consumable()),
      author: currentUser?._id ?? null,
      note: noteValue ? noteValue : null
    };

    this.releaseLoading.set(true);
    this.releaseError.set(null);
    this.releaseSuccess.set(null);
    this.reserveError.set(null);
    this.reserveSuccess.set(null);

    this.svc.releaseReservation(payload).subscribe({
      next: () => {
        this.releaseLoading.set(false);
        this.releaseSuccess.set('Reprise effectuée.');
        this.reserveForm.reset({ toUser: '', qty: 1, note: '' });
        this.load();
        this.loadHistory(true);
      },
      error: (err: HttpErrorResponse) => {
        this.releaseLoading.set(false);
        this.releaseError.set(this.apiError(err, 'Erreur reprise consommable'));
      }
    });
  }

  clearReserve(): void {
    this.reserveForm.reset({ toUser: '', qty: 1, note: '' });
    this.reserveError.set(null);
    this.reserveSuccess.set(null);
    this.releaseError.set(null);
    this.releaseSuccess.set(null);
  }

  private shortId(id?: string | null): string {
    if (!id) return '—';
    return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
  }

  private loadTechnicians(depotId: string | null): void {
    if (!depotId) {
      this.technicians.set([]);
      return;
    }

    this.techniciansLoading.set(true);
    this.techniciansError.set(null);

    this.userSvc.refreshUsers(true, { role: 'TECHNICIEN', depot: depotId, page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.technicians.set(res.items ?? []);
        this.assignedByTech.set(this.computeAssignedByTechnician());
        this.techniciansLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.techniciansLoading.set(false);
        this.techniciansError.set(this.apiError(err, 'Erreur chargement techniciens'));
      }
    });
  }

  private depotIdValue(c: Consumable | null): string | null {
    if (!c?.idDepot) return null;
    if (typeof c.idDepot === 'string') return c.idDepot;
    if (typeof c.idDepot === 'object' && '_id' in c.idDepot) {
      return c.idDepot._id ?? null;
    }
    return null;
  }

  private computeAssignedByTechnician(): Record<string, number> {
    const items = this.historyItems();
    const totals: Record<string, number> = {};
    for (const it of items) {
      const attrib = it?.attribution;
      if (!attrib || !attrib.toUser) continue;
      const userId = typeof attrib.toUser === 'string' ? attrib.toUser : attrib.toUser._id;
      if (!userId) continue;
      const qty = Number(attrib.quantity ?? 1);
      if (!Number.isFinite(qty)) continue;
      const delta = attrib.action === 'REPRISE' ? -qty : (attrib.action === 'ATTRIBUTION' ? qty : 0);
      totals[userId] = (totals[userId] || 0) + delta;
    }
    return totals;
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
