import { CommonModule, DatePipe } from '@angular/common';
import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Absence, AbsenceHistoryItem, AbsenceStatus, AbsenceType, Depot, EmployeeSummary } from '../../../core/models';
import { AbsenceService } from '../../../core/services/absence.service';
import { HrService } from '../../../core/services/hr.service';
import { DepotService } from '../../../core/services/depot.service';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';

type ViewMode = 'month' | 'week' | 'day';

@Component({
  standalone: true,
  selector: 'app-agenda-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ConfirmActionModal],
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
  readonly showList = signal(false);
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
  readonly editTarget = signal<Absence | null>(null);
  readonly confirmOpen = signal(false);
  readonly confirmTarget = signal<Absence | null>(null);
  readonly confirmStatus = signal<AbsenceStatus>('EN_ATTENTE');
  readonly saveConfirmOpen = signal(false);
  readonly selectedAbsence = signal<Absence | null>(null);

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

  toggleList(): void {
    this.showList.set(!this.showList());
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
    this.editTarget.set(null);
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

  openEdit(absence: Absence): void {
    if (!absence) return;
    this.modalOpen.set(true);
    this.editTarget.set(absence);
    this.absenceForm.reset({
      technicianId: absence.technicianId || '',
      type: absence.type,
      status: absence.status,
      startDate: String(absence.startDate || '').slice(0, 10),
      endDate: String(absence.endDate || '').slice(0, 10),
      isHalfDay: Boolean(absence.isHalfDay),
      halfDayPeriod: absence.halfDayPeriod || 'AM',
      comment: absence.comment || ''
    });
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editTarget.set(null);
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
        const normalized = (res.data || []).map((item) => {
          const technicianId = item.technician?._id || item.technicianId;
          return { ...item, technicianId };
        });
        this.absences.set(normalized);
        const selected = this.selectedAbsence();
        if (selected?._id && !normalized.some((item) => item._id === selected._id)) {
          this.selectedAbsence.set(null);
        }
        if (!this.selectedAbsence() && normalized.length === 1) {
          this.selectedAbsence.set(normalized[0]);
        }
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
    this.saveConfirmOpen.set(true);
  }

  closeSaveConfirm(): void {
    if (this.saving()) return;
    this.saveConfirmOpen.set(false);
  }

  confirmSaveAbsence(): void {
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
    const target = this.editTarget();
    const request$ = target?._id
      ? this.absencesService.update(target._id, payload)
      : this.absencesService.create(payload);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.saveConfirmOpen.set(false);
        this.modalOpen.set(false);
        this.editTarget.set(null);
        this.refresh();
      },
      error: () => {
        this.saving.set(false);
        this.saveConfirmOpen.set(false);
        this.error.set(target?._id ? 'Erreur mise à jour absence' : 'Erreur création absence');
      }
    });
  }

  approveAbsence(absence: Absence): void {
    this.openConfirm(absence, 'APPROUVE');
  }

  refuseAbsence(absence: Absence): void {
    this.openConfirm(absence, 'REFUSE');
  }

  openConfirm(absence: Absence, status: AbsenceStatus): void {
    if (!absence?._id) return;
    this.confirmTarget.set(absence);
    this.confirmStatus.set(status);
    this.confirmOpen.set(true);
  }

  closeConfirm(): void {
    if (this.updating()) return;
    this.confirmOpen.set(false);
    this.confirmTarget.set(null);
  }

  confirmUpdateStatus(): void {
    const absence = this.confirmTarget();
    const status = this.confirmStatus();
    if (!absence?._id || this.updating()) return;
    this.updating.set(true);
    this.absencesService.updateStatus(absence._id, status).subscribe({
      next: (res) => {
        const updated = res?.data;
        if (updated?._id) {
          const nextItems = this.absences().map((item) => {
            if (item._id !== updated._id) return item;
            const technicianId = updated.technician?._id || updated.technicianId || item.technicianId;
            return { ...item, ...updated, technicianId };
          });
          this.absences.set(nextItems);
        }
        this.updating.set(false);
        this.closeConfirm();
        this.refresh();
      },
      error: () => {
        this.updating.set(false);
        this.closeConfirm();
        this.error.set('Erreur mise à jour statut');
      }
    });
  }

  selectAbsence(absence: Absence): void {
    this.selectedAbsence.set(absence);
  }

  private activeRangeKeys(): { start?: string; end?: string } {
    const filters = this.filterForm.getRawValue();
    if (filters.fromDate && filters.toDate) {
      return {
        start: this.dateKeyFromValue(filters.fromDate),
        end: this.dateKeyFromValue(filters.toDate)
      };
    }
    return {};
  }

  private dateKeyFromDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dateKeyFromValue(value: string | Date): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) {
      return this.dateKeyFromDate(value);
    }
    const raw = String(value);
    return raw.includes('T') ? raw.split('T')[0] : raw;
  }

  hasFilterRange(): boolean {
    const filters = this.filterForm.getRawValue();
    return Boolean(filters.fromDate && filters.toDate);
  }

  isInFilterRange(date: Date): boolean {
    const { start, end } = this.activeRangeKeys();
    if (!start || !end) return false;
    const value = this.dateKeyFromDate(date);
    return value >= start && value <= end;
  }

  isFilterRangeStart(date: Date): boolean {
    const { start } = this.activeRangeKeys();
    if (!start) return false;
    return this.dateKeyFromDate(date) === start;
  }

  isFilterRangeEnd(date: Date): boolean {
    const { end } = this.activeRangeKeys();
    if (!end) return false;
    return this.dateKeyFromDate(date) === end;
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

  historyDetails(item: AbsenceHistoryItem): string[] {
    const payload = item.payload as Record<string, unknown> | undefined;
    const snapshot =
      (payload?.['after'] as Record<string, unknown> | undefined)
      || (payload?.['snapshot'] as Record<string, unknown> | undefined)
      || (payload?.['before'] as Record<string, unknown> | undefined)
      || undefined;
    if (!snapshot) return [];
    const techId = snapshot['technician'] as string | { _id?: string } | undefined;
    const depotId = snapshot['depot'] as string | { _id?: string; name?: string } | undefined;
    const type = snapshot['type'] as AbsenceType | undefined;
    const status = snapshot['status'] as AbsenceStatus | undefined;
    const startDate = snapshot['startDate'] as string | undefined;
    const endDate = snapshot['endDate'] as string | undefined;
    const isHalfDay = Boolean(snapshot['isHalfDay']);
    const halfDayPeriod = snapshot['halfDayPeriod'] as 'AM' | 'PM' | undefined;
    const comment = String(snapshot['comment'] || '').trim();

    const details: string[] = [];
    const techIdValue = typeof techId === 'string' ? techId : techId?._id;
    if (techIdValue) {
      details.push(`Technicien: ${this.technicianLabel(techIdValue)}`);
    }
    if (type) details.push(`Type: ${this.typeLabel(type)}`);
    if (status) details.push(`Statut: ${this.statusLabel(status)}`);
    if (startDate || endDate) {
      const start = startDate ? this.datePipe.transform(startDate, 'shortDate') : '—';
      const end = endDate ? this.datePipe.transform(endDate, 'shortDate') : '—';
      details.push(`Dates: ${start} → ${end}`);
    }
    if (isHalfDay) {
      details.push(`Demi-journée: ${halfDayPeriod === 'PM' ? 'Après-midi' : 'Matin'}`);
    }
    const depotIdValue = typeof depotId === 'string' ? depotId : depotId?._id;
    if (depotIdValue) {
      const depot = this.depots().find((d) => d._id === depotIdValue);
      details.push(`Dépôt: ${this.depotLabel(depot || null)}`);
    }
    if (comment) {
      details.push(`Commentaire: ${comment}`);
    }
    return details;
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
    const day = this.dateKeyFromDate(date);
    return this.visibleAbsences().filter((absence) => {
      const start = this.dateKeyFromValue(absence.startDate || '');
      const end = this.dateKeyFromValue(absence.endDate || '');
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

  absenceTechnicianLabel(absence: Absence): string {
    const tech = absence.technician;
    if (tech && typeof tech === 'object') {
      return formatPersonName(tech.firstName ?? '', tech.lastName ?? '') || tech.email || '—';
    }
    return this.technicianLabel(absence.technicianId);
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
