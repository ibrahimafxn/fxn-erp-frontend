import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { VehicleService } from '../../../../core/services/vehicle.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/roles.model';
import { Vehicle, VehicleBreakdown, VehicleBreakdownListResult } from '../../../../core/models';
import { DetailBack } from '../../../../core/utils/detail-back';
import { formatPersonName } from '../../../../core/utils/text-format';
import { formatPageRange } from '../../../../core/utils/pagination';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vehicle-breakdowns',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './vehicle-breakdowns.html',
  styleUrls: ['./vehicle-breakdowns.scss']
})
export class VehicleBreakdowns extends DetailBack {
  private svc = inject(VehicleService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private datePipe = inject(DatePipe);
  private fb = inject(FormBuilder);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly vehicle = signal<Vehicle | null>(null);
  readonly result = signal<VehicleBreakdownListResult | null>(null);
  readonly resolveOpen = signal(false);
  readonly resolveTarget = signal<VehicleBreakdown | null>(null);
  readonly resolvingId = signal<string | null>(null);

  readonly resolveForm = this.fb.nonNullable.group({
    resolvedAt: this.fb.nonNullable.control('', [Validators.required]),
    resolvedGarage: this.fb.nonNullable.control(''),
    resolvedCost: this.fb.nonNullable.control(''),
    resolvedNote: this.fb.nonNullable.control('')
  });

  readonly page = signal(1);
  readonly limit = signal(20);
  readonly pageRange = formatPageRange;

  readonly items = computed<VehicleBreakdown[]>(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);
  readonly isReadOnly = computed(() => this.auth.getUserRole() === Role.TECHNICIEN);
  readonly canDeclareBreakdown = computed(() => {
    const role = this.auth.getUserRole();
    return role === Role.ADMIN || role === Role.DIRIGEANT || role === Role.GESTION_DEPOT;
  });
  readonly canResolveBreakdown = computed(() => this.canDeclareBreakdown());

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
    this.refresh(true);
  }

  refresh(force = false): void {
    if (!this.id) return;
    if (force) this.page.set(1);

    this.loading.set(true);
    this.error.set(null);

    this.svc.breakdowns(this.id, this.page(), this.limit()).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement pannes'));
      }
    });
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh(false);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.refresh(false);
  }

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.setLimitValue(v);
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh(false);
  }

  declareBreakdown(): void {
    if (!this.canDeclareBreakdown()) return;
    const base = this.isDepotManager()
      ? '/depot/resources/vehicles'
      : this.isReadOnly()
        ? '/technician/resources/vehicles'
        : '/admin/resources/vehicles';
    this.router.navigate([base, this.id, 'breakdown']).then();
  }

  openResolve(b: VehicleBreakdown): void {
    if (!this.canResolveBreakdown()) return;
    this.resolveTarget.set(b);
    this.resolveOpen.set(true);
    const today = new Date().toISOString().slice(0, 10);
    this.resolveForm.setValue({
      resolvedAt: today,
      resolvedGarage: '',
      resolvedCost: '',
      resolvedNote: ''
    });
  }

  closeResolve(): void {
    if (this.resolvingId()) return;
    this.resolveOpen.set(false);
    this.resolveTarget.set(null);
  }

  confirmResolve(): void {
    const target = this.resolveTarget();
    if (!target || !this.id) return;
    if (this.resolveForm.invalid) {
      this.resolveForm.markAllAsTouched();
      return;
    }

    const raw = this.resolveForm.getRawValue();
    const resolvedAt = raw.resolvedAt ? `${raw.resolvedAt}T00:00:00` : undefined;
    const resolvedGarage = raw.resolvedGarage.trim() || null;
    const resolvedNote = raw.resolvedNote.trim() || null;
    const resolvedCost = raw.resolvedCost !== '' ? Number(raw.resolvedCost) : null;
    const costValue = Number.isFinite(resolvedCost ?? 0) ? resolvedCost : null;

    this.resolvingId.set(target._id);
    this.svc.resolveBreakdown(this.id, target._id, {
      resolvedAt,
      resolvedGarage,
      resolvedCost: costValue,
      resolvedNote
    }).subscribe({
      next: () => {
        this.resolvingId.set(null);
        this.closeResolve();
        this.refresh(true);
      },
      error: (err: HttpErrorResponse) => {
        this.resolvingId.set(null);
        this.error.set(this.apiError(err, 'Erreur clôture panne'));
      }
    });
  }

  backToDetail(): void {
    const base = this.isDepotManager()
      ? '/depot/resources/vehicles'
      : this.isReadOnly()
        ? '/technician/resources/vehicles'
        : '/admin/resources/vehicles';
    this.router.navigate([base, this.id, 'detail']).then();
  }

  authorLabel(b: VehicleBreakdown): string {
    const a = b.author;
    if (!a) return '—';
    if (typeof a === 'object' && '_id' in a) {
      const name = formatPersonName(a.firstName ?? '', a.lastName ?? '');
      return name || a.email || '—';
    }
    return String(a);
  }

  repairLabel(b: VehicleBreakdown): string {
    return b.repairMode === 'GARAGE' ? 'Garage' : 'Sur place';
  }

  needsTowLabel(b: VehicleBreakdown): string {
    return b.needsTow ? 'Oui' : 'Non';
  }

  createdAtText(b: VehicleBreakdown): string {
    return this.datePipe.transform(b.createdAt as any, 'short') ?? '—';
  }

  resolvedAtText(b: VehicleBreakdown): string {
    return this.datePipe.transform(b.resolvedAt as any, 'short') ?? '—';
  }

  statusLabel(b: VehicleBreakdown): string {
    return b.status === 'RESOLVED' ? 'Réparé' : 'Ouvert';
  }

  private loadVehicle(): void {
    if (!this.id) return;
    this.svc.getById(this.id).subscribe({
      next: (v) => this.vehicle.set(v),
      error: () => {}
    });
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
