import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Absence, AbsenceStatus, AbsenceType } from '../../../core/models';
import { AbsenceService } from '../../../core/services/absence.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';

@Component({
  standalone: true,
  selector: 'app-technician-agenda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ConfirmActionModal],
  providers: [DatePipe],
  templateUrl: './technician-agenda.html',
  styleUrls: ['./technician-agenda.scss'],
})
export class TechnicianAgenda {
  private fb = inject(FormBuilder);
  private absencesService = inject(AbsenceService);
  private authService = inject(AuthService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly absences = signal<Absence[]>([]);
  readonly formValid = signal(false);
  readonly editTarget = signal<Absence | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly confirmUpdateOpen = signal(false);
  readonly confirmDeleteOpen = signal(false);
  readonly confirmDeleteTarget = signal<Absence | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control(''),
    type: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control('')
  });

  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<AbsenceType>('CONGE', [Validators.required]),
    startDate: this.fb.nonNullable.control('', [Validators.required]),
    endDate: this.fb.nonNullable.control('', [Validators.required]),
    isHalfDay: this.fb.nonNullable.control(false),
    halfDayPeriod: this.fb.nonNullable.control<'AM' | 'PM'>('AM'),
    comment: this.fb.nonNullable.control('')
  });

  readonly canSubmit = computed(() => this.formValid() && !this.saving());
  readonly isEditing = computed(() => !!this.editTarget());

  constructor() {
    this.formValid.set(this.form.valid);
    this.form.statusChanges.subscribe(() => {
      this.formValid.set(this.form.valid);
    });
    this.form.controls.isHalfDay.valueChanges.subscribe((isHalfDay) => {
      const endControl = this.form.controls.endDate;
      if (isHalfDay) {
        endControl.disable({ emitEvent: false });
        endControl.setValue(this.form.controls.startDate.value || '', { emitEvent: false });
      } else {
        endControl.enable({ emitEvent: false });
      }
      this.form.updateValueAndValidity({ emitEvent: false });
    });
    this.loadAbsences();
  }

  loadAbsences(): void {
    const user = this.authService.getCurrentUser();
    if (!user?._id) return;
    const filters = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.absencesService.list({
      technicianId: user._id,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      type: filters.type || undefined,
      status: filters.status || undefined
    }).subscribe({
      next: (res) => {
        this.absences.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur chargement absences');
        this.loading.set(false);
      }
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    const user = this.authService.getCurrentUser();
    if (!user?._id) return;
    if (this.editTarget()?._id) {
      this.confirmUpdateOpen.set(true);
      return;
    }
    this.executeSubmit();
  }

  confirmUpdate(): void {
    if (this.saving()) return;
    this.confirmUpdateOpen.set(false);
    this.executeSubmit();
  }

  private executeSubmit(): void {
    const user = this.authService.getCurrentUser();
    if (!user?._id) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const resolvedEnd = this.form.controls.isHalfDay.value
      ? this.form.controls.startDate.value
      : this.form.controls.endDate.value;
    const payload: Absence = {
      technicianId: user._id,
      type: this.form.controls.type.value,
      status: 'EN_ATTENTE' as AbsenceStatus,
      startDate: this.form.controls.startDate.value,
      endDate: resolvedEnd,
      isHalfDay: this.form.controls.isHalfDay.value,
      halfDayPeriod: this.form.controls.halfDayPeriod.value,
      comment: this.form.controls.comment.value
    };
    const target = this.editTarget();
    const request$ = target?._id
      ? this.absencesService.update(target._id, payload)
      : this.absencesService.create(payload);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(target?._id ? 'Demande mise à jour.' : 'Demande envoyée.');
        this.form.reset({
          type: 'CONGE',
          startDate: '',
          endDate: '',
          isHalfDay: false,
          halfDayPeriod: 'AM',
          comment: ''
        });
        this.editTarget.set(null);
        this.loadAbsences();
      },
      error: () => {
        this.saving.set(false);
        this.error.set(target?._id ? 'Erreur mise à jour' : 'Erreur envoi demande');
      }
    });
  }

  applyFilters(): void {
    this.loadAbsences();
  }

  clearFilters(): void {
    this.filterForm.reset({ fromDate: '', toDate: '', type: '', status: '' });
    this.loadAbsences();
  }

  startEdit(absence: Absence): void {
    if (absence.status && absence.status !== 'EN_ATTENTE') return;
    this.editTarget.set(absence);
    this.form.reset({
      type: absence.type as AbsenceType,
      startDate: this.dateKeyFromValue(absence.startDate) || '',
      endDate: this.dateKeyFromValue(absence.endDate) || '',
      isHalfDay: !!absence.isHalfDay,
      halfDayPeriod: (absence.halfDayPeriod as 'AM' | 'PM') || 'AM',
      comment: absence.comment || ''
    });
    if (this.form.controls.isHalfDay.value) {
      this.form.controls.endDate.disable({ emitEvent: false });
    }
  }

  cancelEdit(): void {
    this.editTarget.set(null);
    this.form.reset({
      type: 'CONGE',
      startDate: '',
      endDate: '',
      isHalfDay: false,
      halfDayPeriod: 'AM',
      comment: ''
    });
    this.form.controls.endDate.enable({ emitEvent: false });
  }

  deleteAbsence(absence: Absence): void {
    if (!absence?._id || absence.status !== 'EN_ATTENTE' || this.deletingId()) return;
    this.confirmDeleteTarget.set(absence);
    this.confirmDeleteOpen.set(true);
  }

  confirmDelete(): void {
    const absence = this.confirmDeleteTarget();
    if (!absence?._id || this.deletingId()) return;
    this.confirmDeleteOpen.set(false);
    this.deletingId.set(absence._id);
    this.absencesService.remove(absence._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        if (this.editTarget()?._id === absence._id) this.cancelEdit();
        this.confirmDeleteTarget.set(null);
        this.loadAbsences();
      },
      error: () => {
        this.deletingId.set(null);
        this.confirmDeleteTarget.set(null);
        this.error.set('Erreur suppression');
      }
    });
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    return this.datePipe.transform(value, 'dd/MM/yyyy') || '—';
  }

  private dateKeyFromValue(value: string | Date): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const raw = String(value);
    return raw.includes('T') ? raw.split('T')[0] : raw;
  }

  statusLabel(status?: AbsenceStatus): string {
    switch (status) {
      case 'APPROUVE': return 'Approuvé';
      case 'REFUSE': return 'Refusé';
      case 'EN_ATTENTE':
      default: return 'En attente';
    }
  }

  statusClass(status?: AbsenceStatus): string {
    if (status === 'APPROUVE') return 'status-ok';
    if (status === 'REFUSE') return 'status-refused';
    return 'status-pending';
  }
}
