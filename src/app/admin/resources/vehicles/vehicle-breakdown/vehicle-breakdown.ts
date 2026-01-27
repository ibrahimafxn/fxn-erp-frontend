import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { VehicleService } from '../../../../core/services/vehicle.service';
import { Vehicle } from '../../../../core/models';
import { DetailBack } from '../../../../core/utils/detail-back';
import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/roles.model';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vehicle-breakdown',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './vehicle-breakdown.html',
  styleUrls: ['./vehicle-breakdown.scss']
})
export class VehicleBreakdown extends DetailBack {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private vehicleService = inject(VehicleService);
  private auth = inject(AuthService);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly vehicle = signal<Vehicle | null>(null);

  readonly form = this.fb.nonNullable.group({
    problemType: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    needsTow: this.fb.nonNullable.control(false),
    repairMode: this.fb.nonNullable.control<'GARAGE' | 'ON_SITE'>('ON_SITE', [Validators.required]),
    garageName: this.fb.nonNullable.control(''),
    garageAddress: this.fb.nonNullable.control(''),
    address: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    note: this.fb.nonNullable.control('')
  }, { validators: [this.garageRequiredValidator(), this.garageAddressRequiredValidator()] });

  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status
  });

  private readonly repairMode = toSignal(this.form.controls.repairMode.valueChanges, {
    initialValue: this.form.controls.repairMode.value
  });

  readonly canSubmit = computed(() => !this.saving() && this.formStatus() === 'VALID');
  readonly showGarageField = computed(() => this.repairMode() === 'GARAGE');

  readonly vehicleLabel = computed(() => {
    const v = this.vehicle();
    if (!v) return '—';
    const name = [v.brand, v.model].filter(Boolean).join(' ').trim();
    const plate = v.plateNumber ? `· ${v.plateNumber}` : '';
    return `${name || 'Véhicule'} ${plate}`.trim();
  });

  constructor() {
    super();
    this.loadVehicle();
  }

  submit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.id) return;

    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      problemType: raw.problemType.trim(),
      needsTow: raw.needsTow,
      repairMode: raw.repairMode,
      garageName: this.showGarageField() ? raw.garageName.trim() : null,
      garageAddress: this.showGarageField() ? raw.garageAddress.trim() : null,
      address: raw.address.trim(),
      note: raw.note.trim() || null
    };

    this.vehicleService.declareBreakdown(this.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.navigateAfterSave();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Erreur déclaration panne');
      }
    });
  }

  cancel(): void {
    this.navigateAfterSave();
  }

  isInvalid(name: 'problemType' | 'repairMode' | 'garageName' | 'garageAddress' | 'address'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  garageRequired(): boolean {
    const control = this.form.get('garageName');
    return this.form.hasError('garageRequired') && !!control && (control.dirty || control.touched);
  }

  garageAddressRequired(): boolean {
    const control = this.form.get('garageAddress');
    return this.form.hasError('garageAddressRequired') && !!control && (control.dirty || control.touched);
  }

  private loadVehicle(): void {
    if (!this.id) return;
    this.loading.set(true);
    this.vehicleService.getById(this.id).subscribe({
      next: (v) => {
        this.vehicle.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement véhicule');
      }
    });
  }

  private navigateAfterSave(): void {
    const role = this.auth.getUserRole();
    const base = role === Role.GESTION_DEPOT
      ? '/depot/resources/vehicles'
      : role === Role.TECHNICIEN
        ? '/technician/resources/vehicles'
        : '/admin/resources/vehicles';
    this.router.navigate([base, this.id, 'detail']).then();
  }

  private garageRequiredValidator(): ValidatorFn {
    return (group) => {
      const mode = group.get('repairMode')?.value;
      const garage = String(group.get('garageName')?.value || '').trim();
      if (mode === 'GARAGE' && !garage) return { garageRequired: true };
      return null;
    };
  }

  private garageAddressRequiredValidator(): ValidatorFn {
    return (group) => {
      const mode = group.get('repairMode')?.value;
      const addr = String(group.get('garageAddress')?.value || '').trim();
      if (mode === 'GARAGE' && !addr) return { garageAddressRequired: true };
      return null;
    };
  }
}
