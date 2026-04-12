import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AbsenceService } from '../../../core/services/absence.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotificationService } from '../../../core/services/app-notification.service';
import { Absence, AbsenceStatus, AbsenceType } from '../../../core/models/absence.model';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';
import { formatPageRange } from '../../../core/utils/pagination';
import { preferredPageSize } from '../../../core/utils/page-size';

@Component({
  selector: 'app-technician-absences',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ConfirmDeleteModal, TechnicianMobileNav],
  templateUrl: './technician-absences.html',
  styleUrl: './technician-absences.scss',
})
export class TechnicianAbsences {
  private absenceService = inject(AbsenceService);
  private auth = inject(AuthService);
  private notif = inject(AppNotificationService);

  readonly loading = signal(false);
  readonly items = signal<Absence[]>([]);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly pageRange = formatPageRange;

  // Form signals
  readonly formType = signal<AbsenceType>('CONGE');
  readonly formStart = signal<string>(this.todayStr());
  readonly formEnd = signal<string>(this.todayStr());
  readonly formComment = signal<string>('');
  readonly formSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal(false);

  // Delete modal
  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly total = computed(() => this.items().length);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly pagedItems = computed(() => {
    const items = this.items();
    const limit = this.limit();
    if (limit <= 0) return items;
    const start = (this.page() - 1) * limit;
    return items.slice(start, start + limit);
  });

  constructor() {
    this.loadAbsences();
  }

  loadAbsences(): void {
    this.loading.set(true);
    const previous = this.items();
    this.absenceService.list().subscribe({
      next: (res) => {
        const current = res?.data || [];
        this.notifyStatusChanges(previous, current);
        this.items.set(current);
        const pageCount = this.pageCount();
        if (this.page() > pageCount) this.page.set(pageCount);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  submitRequest(): void {
    const start = this.formStart();
    const end = this.formEnd();
    if (!start || !end) {
      this.formError.set('Veuillez renseigner les dates de début et de fin.');
      return;
    }
    if (new Date(end) < new Date(start)) {
      this.formError.set('La date de fin doit être égale ou postérieure à la date de début.');
      return;
    }
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser) {
      this.formError.set('Utilisateur non connecté.');
      return;
    }
    this.formError.set(null);
    this.formSubmitting.set(true);
    const payload: Absence = {
      technicianId: currentUser._id,
      type: this.formType(),
      startDate: start,
      endDate: end,
      comment: this.formComment() || undefined,
      status: 'EN_ATTENTE',
    };
    this.absenceService.create(payload).subscribe({
      next: () => {
        this.formSubmitting.set(false);
        this.resetForm();
        this.formSuccess.set(true);
        setTimeout(() => this.formSuccess.set(false), 3000);
        this.notif.notifyAction(
          'Demande envoyée',
          `Votre demande de ${this.typeLabel(payload.type)} a bien été transmise.`,
          `absence-submit-${Date.now()}`
        );
        this.notif.beep('success');
        this.loadAbsences();
      },
      error: (err) => {
        this.formSubmitting.set(false);
        this.formError.set(err?.error?.message || err?.message || "Erreur lors de l'envoi de la demande.");
      },
    });
  }

  openCancelModal(id: string): void {
    this.pendingDeleteId.set(id);
    this.deleteModalOpen.set(true);
  }

  closeCancelModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
  }

  confirmCancel(): void {
    const id = this.pendingDeleteId();
    if (!id) return;
    this.deleting.set(true);
    this.absenceService.remove(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.closeCancelModal();
        this.loadAbsences();
      },
      error: () => {
        this.deleting.set(false);
        this.closeCancelModal();
      },
    });
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.update((p) => p - 1);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.update((p) => p + 1);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
  }

  resetForm(): void {
    this.formType.set('CONGE');
    this.formStart.set(this.todayStr());
    this.formEnd.set(this.todayStr());
    this.formComment.set('');
    this.formError.set(null);
  }

  statusLabel(status: AbsenceStatus): string {
    if (status === 'EN_ATTENTE') return 'En attente';
    if (status === 'APPROUVE') return 'Approuvée';
    if (status === 'REFUSE') return 'Refusée';
    return status;
  }

  typeLabel(type: AbsenceType): string {
    if (type === 'CONGE') return 'Congé payé';
    if (type === 'MALADIE') return 'Arrêt maladie';
    if (type === 'PERMISSION') return 'Permission';
    if (type === 'FORMATION') return 'Formation';
    if (type === 'AUTRE') return 'Autre';
    return type;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  daysDiff(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    return Math.max(1, diff);
  }

  canCancel(item: Absence): boolean {
    return item.status === 'EN_ATTENTE';
  }

  pendingDeleteName(): string {
    const id = this.pendingDeleteId();
    if (!id) return '';
    const item = this.items().find((a) => a._id === id);
    return item ? this.typeLabel(item.type) : '';
  }

  private notifyStatusChanges(prev: Absence[], next: Absence[]): void {
    if (!prev.length) return;
    const prevMap = new Map(prev.map(a => [a._id, a.status]));
    next.forEach(a => {
      const prevStatus = prevMap.get(a._id);
      if (!prevStatus || prevStatus === a.status || prevStatus !== 'EN_ATTENTE') return;
      if (a.status === 'APPROUVE') {
        this.notif.notifyAction(
          'Demande approuvée',
          `Votre demande de ${this.typeLabel(a.type)} a été approuvée.`,
          `absence-approved-${a._id}`
        );
        this.notif.beep('success');
      } else if (a.status === 'REFUSE') {
        this.notif.notifyAction(
          'Demande refusée',
          `Votre demande de ${this.typeLabel(a.type)} a été refusée.`,
          `absence-refused-${a._id}`
        );
        this.notif.beep('alert');
      }
    });
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
