import { CommonModule, DatePipe } from '@angular/common';
import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Absence, AbsenceHistoryItem, AbsenceStatus, AbsenceType, Depot, EmployeeSummary } from '../../../core/models';
import { AbsenceService } from '../../../core/services/absence.service';
import { HrService } from '../../../core/services/hr.service';
import { DepotService } from '../../../core/services/depot.service';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';

type ViewMode = 'month' | 'week' | 'day';

@Component({
  standalone: true,
  selector: 'app-agenda-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  templateUrl: './agenda-page.html',
  styleUrl: './agenda-page.scss'
})
export class AgendaPage {
  private fb = inject(FormBuilder);
  private absencesService = inject(AbsenceService);
  private hrService = inject(HrService);
  private depotService = inject(DepotService);
  private datePipe = inject(DatePipe);

  readonly viewMode = signal<ViewMode>('month');
  readonly currentDate = signal(new Date());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly absences = signal<Absence[]>([]);
  readonly users = signal<EmployeeSummary[]>([]);
  readonly depots = signal<Depot[]>([]);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly updating = signal(false);
  readonly historyOpen = signal(false);
  readonly historyLoading = signal(false);
  readonly historyItems = signal<AbsenceHistoryItem[]>([]);
  readonly historyTarget = signal<Absence | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    technicianId: this.fb.nonNullable.control(''),
    depotId: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control(''),
    type: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly absenceForm = this.fb.nonNullable.group({
    technicianId: this.fb.nonNullable.control('', [Validators.required]),
    type: this.fb.nonNullable.control<AbsenceType>('CONGE', [Validators.required]),
    status: this.fb.nonNullable.control<AbsenceStatus>('EN_ATTENTE', [Validators.required]),
    startDate: this.fb.nonNullable.control('', [Validators.required]),
    endDate: this.fb.nonNullable.control('', [Validators.required]),
    isHalfDay: this.fb.nonNullable.control(false),
    halfDayPeriod: this.fb.nonNullable.control<'AM' | 'PM'>('AM'),
    comment: this.fb.nonNullable.control('')
  });

  readonly weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  readonly rangeLabel = computed(() => {
    const date = this.currentDate();
    const month = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  });

  readonly monthDays = computed(() => {
    const date = this.currentDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startDay);
    const days: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return days;
  });

  readonly visibleAbsences = computed(() => {
    const filters = this.filterForm.getRawValue();
    const items = this.absences();
    return items.filter((absence) => {
      if (filters.technicianId && absence.technicianId !== filters.technicianId) return false;
      if (filters.depotId && absence.depot?._id !== filters.depotId) return false;
      if (filters.status && absence.status !== filters.status) return false;
      if (filters.type && absence.type !== filters.type) return false;
      return true;
    });
  });

  constructor() {
    this.loadUsers();
    this.loadDepots();
    this.refresh();
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  goPrev(): void {
    const date = new Date(this.currentDate());
    if (this.viewMode() === 'day') {
      date.setDate(date.getDate() - 1);
    } else if (this.viewMode() === 'week') {
      date.setDate(date.getDate() - 7);
    } else {
      date.setMonth(date.getMonth() - 1);
    }
    this.currentDate.set(date);
  }

  goNext(): void {
    const date = new Date(this.currentDate());
    if (this.viewMode() === 'day') {
      date.setDate(date.getDate() + 1);
    } else if (this.viewMode() === 'week') {
      date.setDate(date.getDate() + 7);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    this.currentDate.set(date);
  }

  openModal(): void {
    this.modalOpen.set(true);
    this.absenceForm.reset({
      technicianId: '',
      type: 'CONGE',
      status: 'EN_ATTENTE',
      startDate: '',
      endDate: '',
      isHalfDay: false,
      halfDayPeriod: 'AM',
      comment: ''
    });
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  applyFilters(): void {
    this.refresh();
  }

  clearFilters(): void {
    this.filterForm.reset({
      technicianId: '',
      depotId: '',
      status: '',
      type: '',
      fromDate: '',
      toDate: ''
    });
    this.refresh();
  }

  refresh(): void {
    const filters = this.filterForm.getRawValue();
    const range = this.resolveRange(filters.fromDate, filters.toDate);
    this.loading.set(true);
    this.error.set(null);
    this.absencesService.list({
      fromDate: range.fromDate,
      toDate: range.toDate,
      technicianId: filters.technicianId || undefined,
      depotId: filters.depotId || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined
    }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set('Erreur chargement absences');
          this.loading.set(false);
          return;
        }
        this.absences.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur chargement absences');
        this.loading.set(false);
      }
    });
  }

  saveAbsence(): void {
    if (this.absenceForm.invalid) {
      this.absenceForm.markAllAsTouched();
      return;
    }
    const raw = this.absenceForm.getRawValue();
    this.saving.set(true);
    const payload: Absence = {
      technicianId: raw.technicianId,
      type: raw.type,
      status: raw.status,
      startDate: raw.startDate,
      endDate: raw.endDate,
      isHalfDay: raw.isHalfDay,
      halfDayPeriod: raw.halfDayPeriod,
      comment: raw.comment
    };
    this.absencesService.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.refresh();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Erreur création absence');
      }
    });
  }

  approveAbsence(absence: Absence): void {
    this.updateStatus(absence, 'APPROUVE');
  }

  refuseAbsence(absence: Absence): void {
    this.updateStatus(absence, 'REFUSE');
  }

  private updateStatus(absence: Absence, status: AbsenceStatus): void {
    if (!absence?._id || this.updating()) return;
    if (!confirm(`Confirmer le statut: ${this.statusLabel(status)} ?`)) return;
    this.updating.set(true);
    this.absencesService.updateStatus(absence._id, status).subscribe({
      next: () => {
        this.updating.set(false);
        this.refresh();
      },
      error: () => {
        this.updating.set(false);
        this.error.set('Erreur mise à jour statut');
      }
    });
  }

  openHistory(absence: Absence): void {
    if (!absence?._id) return;
    this.historyOpen.set(true);
    this.historyTarget.set(absence);
    this.historyLoading.set(true);
    this.historyItems.set([]);
    this.absencesService.history(absence._id).subscribe({
      next: (res) => {
        this.historyItems.set(res.data || []);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyLoading.set(false);
        this.error.set('Erreur chargement historique');
      }
    });
  }

  closeHistory(): void {
    this.historyOpen.set(false);
    this.historyTarget.set(null);
    this.historyItems.set([]);
  }

  historyActor(item: AbsenceHistoryItem): string {
    const actor = item.actor;
    if (!actor) return '—';
    return formatPersonName(actor.firstName ?? '', actor.lastName ?? '') || actor.email || '—';
  }

  historyActionLabel(item: AbsenceHistoryItem): string {
    switch (item.action) {
      case 'CREATE': return 'Création';
      case 'UPDATE': return 'Mise à jour';
      case 'STATUS': return 'Changement de statut';
      case 'DELETE': return 'Suppression';
      default: return '—';
    }
  }

  historyPayloadLabel(item: AbsenceHistoryItem): string {
    const payload = item.payload || {};
    const statusValue = (payload as { status?: string }).status;
    if (item.action === 'STATUS' && typeof statusValue === 'string') {
      return this.statusLabel(statusValue as AbsenceStatus);
    }
    if (item.action === 'CREATE') {
      return 'Création d’une absence';
    }
    if (item.action === 'DELETE') {
      return 'Suppression';
    }
    return '';
  }

  dayLabel(date: Date): string {
    return this.datePipe.transform(date, 'EEE d') || '';
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isOutsideMonth(date: Date): boolean {
    return date.getMonth() !== this.currentDate().getMonth();
  }

  absencesForDay(date: Date): Absence[] {
    const day = date.toISOString().slice(0, 10);
    return this.visibleAbsences().filter((absence) => {
      const start = absence.startDate?.slice(0, 10);
      const end = absence.endDate?.slice(0, 10);
      if (!start || !end) return false;
      return day >= start && day <= end;
    });
  }

  typeLabel(type: AbsenceType): string {
    switch (type) {
      case 'CONGE': return 'Congé';
      case 'MALADIE': return 'Maladie';
      case 'FORMATION': return 'Formation';
      case 'AUTRE': return 'Autre';
      default: return '—';
    }
  }

  statusLabel(status: AbsenceStatus): string {
    switch (status) {
      case 'EN_ATTENTE': return 'En attente';
      case 'APPROUVE': return 'Approuvé';
      case 'REFUSE': return 'Refusé';
      default: return '—';
    }
  }

  statusClass(status: AbsenceStatus): string {
    if (status === 'APPROUVE') return 'status-ok';
    if (status === 'REFUSE') return 'status-refused';
    return 'status-pending';
  }

  technicianLabel(id?: string | null): string {
    if (!id) return '—';
    const user = this.users().find((u) => u.user?._id === id)?.user;
    if (!user) return '—';
    return formatPersonName(user.firstName ?? '', user.lastName ?? '') || user.email || '—';
  }

  depotLabel(depot?: Depot | null): string {
    if (!depot?.name) return '—';
    return formatDepotName(depot.name);
  }

  private resolveRange(from: string, to: string): { fromDate?: string; toDate?: string } {
    const fromDate = from ? String(from) : '';
    const toDate = to ? String(to) : '';
    if (fromDate || toDate) {
      return { fromDate: fromDate || undefined, toDate: toDate || undefined };
    }
    const date = this.currentDate();
    if (this.viewMode() === 'day') {
      const day = date.toISOString().slice(0, 10);
      return { fromDate: day, toDate: day };
    }
    if (this.viewMode() === 'week') {
      const monday = new Date(date);
      const offset = (monday.getDay() + 6) % 7;
      monday.setDate(monday.getDate() - offset);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return {
        fromDate: monday.toISOString().slice(0, 10),
        toDate: sunday.toISOString().slice(0, 10)
      };
    }
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      fromDate: first.toISOString().slice(0, 10),
      toDate: last.toISOString().slice(0, 10)
    };
  }

  private loadUsers(): void {
    this.hrService.listEmployees({ role: 'TECHNICIEN', page: 1, limit: 1000 }).subscribe({
      next: (res) => this.users.set(res.items ?? []),
      error: () => this.users.set([])
    });
  }

  private loadDepots(): void {
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => this.depots.set(res.items ?? []),
      error: () => this.depots.set([])
    });
  }
}
