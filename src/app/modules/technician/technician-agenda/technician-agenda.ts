import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Absence, AbsenceStatus, AbsenceType } from '../../../core/models';
import { AbsenceService } from '../../../core/services/absence.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-technician-agenda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
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
    this.absencesService.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Demande envoyée.');
        this.form.reset({
          type: 'CONGE',
          startDate: '',
          endDate: '',
          isHalfDay: false,
          halfDayPeriod: 'AM',
          comment: ''
        });
        this.loadAbsences();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Erreur envoi demande');
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

  formatDate(value?: string | null): string {
    if (!value) return '—';
    return this.datePipe.transform(value, 'dd/MM/yyyy') || '—';
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
