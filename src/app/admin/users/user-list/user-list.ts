import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import {User, Depot} from '../../../core/models';
import { UserListResult } from '../../../core/models/user-list-result.model';
import {ConfirmDeleteModal} from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import {DATE_FORMAT_FR} from '../../../core/constant/date-format';
import {DetailBack} from '../../../core/utils/detail-back';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { downloadBlob } from '../../../core/utils/download';

@Component({
  standalone: true,
  selector: 'app-user-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './user-list.html',
  styleUrls: ['./user-list.scss'],
})
export class UserList extends DetailBack {

  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');
  readonly pendingDeleteLabel = signal<string>('élément');

  private userService = inject(UserService);
  private depotSvc = inject(DepotService);
  private fb = inject(FormBuilder);
  private datePipe = inject(DatePipe);

  // service signals
  readonly loading = this.userService.loading;
  readonly error = this.userService.error;

  // ⚠️ tu dois exposer result dans UserService comme pour depots/consumables
  readonly result: Signal<UserListResult | null> = this.userService.result;

  // UI state
  readonly deletingId = signal<string | null>(null);

  // Pagination state
  readonly page = signal(1);
  readonly limit = signal(25);

  // Depots (filtre)
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  // Filtres
  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    role: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
  });

  // derived
  readonly items = computed(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  constructor() {
    super();
    this.loadDepots();
    this.refresh(true);
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    return this.datePipe.transform(date, DATE_FORMAT_FR) ?? '';
  }

  userName(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || u._id;
  }

  userInitials(u: User): string {
    const first = u.firstName?.[0] ?? '';
    const last = u.lastName?.[0] ?? '';
    const value = `${first}${last}`.toUpperCase();
    return value || (u.email?.[0] ?? '').toUpperCase();
  }

  refresh(force = false): void {
    const v = this.filterForm.getRawValue();

    this.userService.refreshUsers(force, {
      q: v.q.trim() || undefined,
      role: v.role || undefined,
      depot: v.depot || undefined,
      page: this.page(),
      limit: this.limit(),
    }).subscribe({ error: () => {} });
  }

  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({ q: '', role: '', depot: '' });
    this.page.set(1);
    this.refresh(true);
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.refresh(true);
  }

  nextPage(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.set(this.page() + 1);
    this.refresh(true);
  }

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;

    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;

    this.setLimit(v);
  }

  setLimit(v: number): void {
    this.limit.set(v);
    this.page.set(1);
    this.refresh(true);
  }

  createNew(): void {
    this.router.navigate(['/admin/users/new']).then();
  }

  exportCsv(): void {
    const v = this.filterForm.getRawValue();
    this.userService.exportCsv({
      q: v.q.trim() || undefined,
      role: v.role || undefined,
      depot: v.depot || undefined
    }).subscribe({
      next: (blob) => downloadBlob(blob, `users-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => {}
    });
  }

  exportPdf(): void {
    const v = this.filterForm.getRawValue();
    this.userService.exportPdf({
      q: v.q.trim() || undefined,
      role: v.role || undefined,
      depot: v.depot || undefined
    }).subscribe({
      next: (blob) => downloadBlob(blob, `users-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => {}
    });
  }

  exportXlsx(): void {
    const v = this.filterForm.getRawValue();
    this.userService.exportXlsx({
      q: v.q.trim() || undefined,
      role: v.role || undefined,
      depot: v.depot || undefined
    }).subscribe({
      next: (blob) => downloadBlob(blob, `users-${new Date().toISOString().slice(0, 10)}.xlsx`),
      error: () => {}
    });
  }

  edit(u: User): void {
    this.router.navigate(['/admin/users', u._id, 'edit']).then();
  }

  openDetail(u: User): void {
    // route détail (à ajouter dans admin.routes.ts si pas encore)
    this.router.navigate(['/admin/users/', u._id, 'detail']).then();
  }

  openDeleteModal(entityLabel: string, entityId: string, entityName: string): void {
    this.pendingDeleteLabel.set(entityLabel);
    this.pendingDeleteId.set(entityId);
    this.pendingDeleteName.set(entityName);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
    this.pendingDeleteLabel.set('élément');
  }

  confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id) return;

    this.deleteModalOpen.set(false);
    this.deletingId.set(id);

    // ⚠️ adapte ici selon le service de la page
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.refresh(true);
        this.closeDeleteModal();
      },
      error: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
      }
    });
  }

  // helpers
  errorMessage(): string {
    const err = this.error() as HttpErrorResponse | null;
    if (!err) return '';
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  createdAtValue(u: User): string | Date | null {
    return u.createdAt ?? null;
  }

  // dépôt label (si idDepot peuplé)
  readonly depotNameById = computed(() => {
    const map = new Map<string, string>();
    for (const d of this.depots()) map.set(d._id, formatDepotName(d.name ?? '') || d.name || '—');
    return map;
  });

  depotLabel(u: User): string {
    const d = u.idDepot;
    if (!d) return '—';

    // populate -> objet
    if (typeof d === 'object' && d !== null && '_id' in d) {
      const obj = d as { _id: string; name?: string };
      return formatDepotName(obj.name ?? '') || this.depotNameById().get(obj._id) || '—';
    }

    // id seul -> on cherche dans la liste des dépôts chargés
    if (typeof d === 'string') {
      return this.depotNameById().get(d) ?? '—';
    }

    return '—';
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }


  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  trackById = (_: number, u: User) => u._id;
}
