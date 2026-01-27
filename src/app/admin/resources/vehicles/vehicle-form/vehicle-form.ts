// vehicle-form
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { DepotService } from '../../../../core/services/depot.service';
import { VehicleService } from '../../../../core/services/vehicle.service';
import {Depot, UserLite} from '../../../../core/models';
import { Vehicle } from '../../../../core/models';
import {DetailBack} from '../../../../core/utils/detail-back';
import { formatDepotName } from '../../../../core/utils/text-format';

type Mode = 'create' | 'edit';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vehicle-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './vehicle-form.html',
  styleUrls: ['./vehicle-form.scss'],
})
export class VehicleForm extends DetailBack {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  private svc = inject(VehicleService);
  private depotsSvc = inject(DepotService);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly mode = computed<Mode>(() => (this.id ? 'edit' : 'create'));

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);
  readonly depotsError = signal<string | null>(null);

  readonly current = signal<Vehicle | null>(null);

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }

  readonly form = this.fb.nonNullable.group({
    plateNumber: this.fb.nonNullable.control('', [Validators.minLength(2)]),
    brand: this.fb.nonNullable.control(''),
    model: this.fb.nonNullable.control(''),
    year: this.fb.control<number | null>(null),
    state: this.fb.nonNullable.control(''),
    idDepot: this.fb.control<string | null>(null),
    assignedTo: this.fb.control<string | UserLite | null>(null),
  });

  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  readonly title = computed(() =>
    this.mode() === 'create' ? 'Nouveau véhicule' : 'Modifier véhicule'
  );

  readonly canSubmit = computed(() => !this.saving() && this.formStatus() === 'VALID');

  constructor() {
    super();
    this.loadDepots();
    if (this.mode() === 'edit') this.loadVehicle();
  }

  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotsSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  private loadVehicle(): void {
    if (!this.id) return;

    this.loading.set(true);
    this.error.set(null);

    this.svc.getById(this.id).subscribe({
      next: (v) => {
        this.current.set(v);

        const depotId =
          typeof v.idDepot === 'string'
            ? v.idDepot
            : null;

        this.form.patchValue({
          plateNumber: v.plateNumber ?? '',
          brand: v.brand ?? '',
          model: v.model ?? '',
          year: typeof v.year === 'number' ? v.year : null,
          state: v.state ?? '',
          idDepot: depotId,
          assignedTo: v.assignedTo ?? null,
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement véhicule');
      },
    });
  }

  private buildPayload(): Partial<Vehicle> {
    const raw = this.form.getRawValue();

    return {
      plateNumber: raw.plateNumber || undefined,
      brand: raw.brand || undefined,
      model: raw.model || undefined,
      year: raw.year ?? undefined, // ✅ null -> undefined
      state: raw.state || undefined,
      idDepot: raw.idDepot ?? undefined,
      assignedTo: raw.assignedTo ?? undefined,
    };
  }

  submit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    if (this.mode() === 'create') {
      this.svc.create(this.buildPayload()).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/admin/resources/vehicles']).then();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Erreur création véhicule');
        },
      });
      return;
    }

    this.svc.update(this.id, this.buildPayload()).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/admin/resources/vehicles']).then();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Erreur mise à jour véhicule');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/resources/vehicles']).then();
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}
