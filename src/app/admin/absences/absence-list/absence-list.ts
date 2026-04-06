import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { AbsenceService } from '../../../core/services/absence.service';
import { Absence, AbsenceStatus, AbsenceType } from '../../../core/models/absence.model';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';

type StatusFilter = '' | 'EN_ATTENTE' | 'APPROUVE' | 'REFUSE';
type TypeFilter = '' | 'CONGE' | 'MALADIE' | 'PERMISSION' | 'FORMATION' | 'AUTRE';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-absence-list',
  imports: [CommonModule, ConfirmActionModal],
  templateUrl: './absence-list.html',
  styleUrl: './absence-list.scss',
})
export class AbsenceList {
  private absenceService = inject(AbsenceService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<Absence[]>([]);

  readonly statusFilter = signal<StatusFilter>('');
  readonly typeFilter = signal<TypeFilter>('');

  readonly confirmRejectOpen = signal(false);
  readonly pendingRejectId = signal<string | null>(null);
  readonly rejecting = signal(false);

  readonly filteredItems = computed(() => {
    const status = this.statusFilter();
    const type = this.typeFilter();
    return this.items().filter((a) => {
      if (status && a.status !== status) return false;
      if (type && a.type !== type) return false;
      return true;
    });
  });

  readonly pendingCount = computed(() => this.items().filter((a) => a.status === 'EN_ATTENTE').length);
  readonly approvedCount = computed(() => this.items().filter((a) => a.status === 'APPROUVE').length);
  readonly refusedCount = computed(() => this.items().filter((a) => a.status === 'REFUSE').length);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    const params: { status?: string; type?: string } = {};
    const status = this.statusFilter();
    const type = this.typeFilter();
    if (status) params.status = status;
    if (type) params.type = type;

    this.absenceService.list(params).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.extractError(err));
      },
    });
  }

  setStatusFilter(v: StatusFilter): void {
    this.statusFilter.set(v);
    this.load();
  }

  setTypeFilter(v: TypeFilter): void {
    this.typeFilter.set(v);
    this.load();
  }

  approve(id: string): void {
    this.absenceService.updateStatus(id, 'APPROUVE').subscribe({
      next: () => this.load(),
      error: () => {},
    });
  }

  reject(id: string): void {
    this.pendingRejectId.set(id);
    this.confirmRejectOpen.set(true);
  }

  onRejectCancel(): void {
    if (this.rejecting()) return;
    this.confirmRejectOpen.set(false);
    this.pendingRejectId.set(null);
  }

  onRejectConfirm(): void {
    const id = this.pendingRejectId();
    if (!id || this.rejecting()) return;

    this.rejecting.set(true);
    this.absenceService.updateStatus(id, 'REFUSE').subscribe({
      next: () => {
        this.rejecting.set(false);
        this.confirmRejectOpen.set(false);
        this.pendingRejectId.set(null);
        this.load();
      },
      error: () => {
        this.rejecting.set(false);
        this.confirmRejectOpen.set(false);
        this.pendingRejectId.set(null);
      },
    });
  }

  statusLabel(status: AbsenceStatus): string {
    switch (status) {
      case 'EN_ATTENTE': return 'En attente';
      case 'APPROUVE': return 'Approuvé';
      case 'REFUSE': return 'Refusé';
      default: return status;
    }
  }

  typeLabel(type: AbsenceType): string {
    switch (type) {
      case 'CONGE': return 'Congé';
      case 'MALADIE': return 'Maladie';
      case 'PERMISSION': return 'Permission';
      case 'FORMATION': return 'Formation';
      case 'AUTRE': return 'Autre';
      default: return type;
    }
  }

  daysDiff(start: string, end: string): number {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = endDate.getTime() - startDate.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  formatDateShort(d: string): string {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  technicianName(absence: Absence): string {
    const t = absence.technician;
    if (!t) return absence.technicianId || '—';
    const name = [t.firstName, t.lastName].filter(Boolean).join(' ');
    return name || t.email || absence.technicianId || '—';
  }

  private extractError(err: HttpErrorResponse): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  trackById = (_: number, a: Absence) => a._id;
}
