import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import { VehicleService } from '../../../core/services/vehicle.service';

import { Role, User, Depot, Vehicle } from '../../../core/models';
import {DetailBack} from '../../../core/utils/detail-back';

type IdOrPopulated = string | { _id: string } | null | undefined;

@Component({
  standalone: true,
  selector: 'app-user-form',
  templateUrl: './user-form.html',
  styleUrls: ['./user-form.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
})
export class UserForm extends DetailBack {
  private fb = inject(FormBuilder);
  private usersService = inject(UserService);
  private depotService = inject(DepotService);
  private vehicleService = inject(VehicleService);
  private route = inject(ActivatedRoute);

  // -----------------------------
  // Mode page : create vs edit
  // -----------------------------
  readonly userId = signal<string | null>(null);
  readonly isEdit = computed(() => !!this.userId());

  // -----------------------------
  // UI state
  // -----------------------------
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  // -----------------------------
  // Depots & Vehicles pour selects
  // -----------------------------
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  readonly vehicles = signal<Vehicle[]>([]);
  readonly vehiclesLoading = signal(false);

  // UX: filtre véhicules disponibles
  readonly showOnlyAvailableVehicles = signal(true);

  // -----------------------------
  // Roles (doit matcher backend)
  // -----------------------------
  readonly roles = [
    { value: Role.DIRIGEANT, label: 'Dirigeant' },
    { value: Role.ADMIN, label: 'Administrateur' },
    { value: Role.GESTION_DEPOT, label: 'Gestion dépôt' },
    { value: Role.TECHNICIEN, label: 'Technicien' },
  ];

  // -----------------------------
  // Formulaire
  // -----------------------------
  readonly form = this.fb.nonNullable.group({
    firstName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    lastName: this.fb.nonNullable.control(''),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    phone: this.fb.nonNullable.control(''),
    role: this.fb.nonNullable.control(Role.TECHNICIEN, [Validators.required]),

    // selects (ids)
    idDepot: this.fb.nonNullable.control(''),          // '' => null côté payload
    assignedVehicle: this.fb.nonNullable.control(''),  // '' => null côté payload
  });

  // -----------------------------
  // UX computed
  // -----------------------------
  readonly isTechnician = computed(() => this.form.controls.role.value === Role.TECHNICIEN);

  /** Liste de véhicules à proposer dans le select */
  readonly vehicleOptions = computed(() => {
    const all = this.vehicles() ?? [];
    const onlyAvail = this.showOnlyAvailableVehicles();

    // valeur sélectionnée (en edit, peut être un véhicule déjà assigné)
    const selectedId = this.form.controls.assignedVehicle.value || '';

    const normalizeAvail = (v: Vehicle): boolean => {
      // Disponible si non assigné (assignedTo null/undefined/'')
      return !v.assignedTo;
    };

    let list = all;

    if (onlyAvail) {
      list = all.filter((v) => normalizeAvail(v) || v._id === selectedId);
    }

    // Tri: disponibles d’abord puis par plaque
    list = [...list].sort((a, b) => {
      const aAvail = normalizeAvail(a) ? 0 : 1;
      const bAvail = normalizeAvail(b) ? 0 : 1;
      if (aAvail !== bAvail) return aAvail - bAvail;

      const ap = (a.plateNumber ?? '').toLowerCase();
      const bp = (b.plateNumber ?? '').toLowerCase();
      return ap.localeCompare(bp);
    });

    return list;
  });

  constructor() {
    super();
    this.loadDepots();
    this.loadVehicles();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.userId.set(id);
      this.loadUser(id);
    }

    // ✅ UX: si role change et devient ≠ TECHNICIEN -> on vide assignedVehicle
    this.form.controls.role.valueChanges.subscribe((role) => {
      if (role !== Role.TECHNICIEN) {
        this.form.controls.assignedVehicle.setValue('');
      }
    });
  }

  // -----------------------------
  // Data loading selects
  // -----------------------------
  private loadDepots(): void {
    this.depotsLoading.set(true);

    this.depotService.refreshDepots(true, { page: 1, limit: 500 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  private loadVehicles(): void {
    this.vehiclesLoading.set(true);

    this.vehicleService.refresh(true, { page: 1, limit: 500 }).subscribe({
      next: (res) => {
        this.vehicles.set(res.items ?? []);
        this.vehiclesLoading.set(false);
      },
      error: () => this.vehiclesLoading.set(false),
    });
  }

  // -----------------------------
  // Chargement user (mode édition)
  // -----------------------------
  private loadUser(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.usersService.getUser(id).subscribe({
      next: (u: User) => {
        const idDepot = this.extractId((u as unknown as { idDepot?: IdOrPopulated }).idDepot) ?? '';
        const assignedVehicle =
          this.extractId((u as unknown as { assignedVehicle?: IdOrPopulated }).assignedVehicle) ?? '';

        this.form.patchValue({
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: u.email || '',
          phone: u.phone || '',
          role: (u.role as Role) || Role.TECHNICIEN,

          idDepot,
          assignedVehicle,
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || err?.message || 'Erreur chargement utilisateur');
      },
    });
  }

  private extractId(x: IdOrPopulated): string | null {
    if (!x) return null;
    if (typeof x === 'string') return x;
    if (typeof x === 'object' && '_id' in x) return x._id;
    return null;
  }

  // -----------------------------
  // Labels UI
  // -----------------------------
  depotLabelById(id: string): string {
    if (!id) return '—';
    const d = this.depots().find((x) => x._id === id);
    return d ? `${d.name}${d.city ? ' · ' + d.city : ''}` : '—';
  }

  vehicleLabel(v: Vehicle): string {
    const plate = v.plateNumber ?? '—';
    const parts: string[] = [];
    if (v.brand) parts.push(v.brand);
    if (v.model) parts.push(v.model);
    const model = parts.join(' ').trim();

    // Badge dispo/assigné en texte (simple)
    const status = v.assignedTo ? 'Assigné' : 'Disponible';
    return model ? `${plate} · ${model} — ${status}` : `${plate} — ${status}`;
  }

  // -----------------------------
  // Soumission (create ou update)
  // -----------------------------
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    const raw = this.form.getRawValue();

    // ✅ Sécurité UX: si pas technicien -> assignedVehicle null
    const assignedVehicle =
      raw.role === Role.TECHNICIEN && raw.assignedVehicle ? raw.assignedVehicle : undefined;

    const payload: Partial<User> & {
      idDepot?: string;
      assignedVehicle?: string;
    } = {
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim() || undefined,
      email: raw.email.trim().toLowerCase(),
      phone: raw.phone.trim() || undefined,
      role: raw.role,

      idDepot: raw.idDepot ? raw.idDepot : undefined,
      assignedVehicle,
    };

    if (!this.isEdit()) {
      this.usersService.createUser(payload).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.success.set(`Utilisateur créé : ${created.firstName} ${created.lastName || ''}`.trim());
          setTimeout(() => this.router.navigate(['/admin/users']), 400);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || err?.message || 'Erreur création utilisateur');
        },
      });
      return;
    }

    const id = this.userId();
    if (!id) return;

    this.usersService.updateUser(id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set('Utilisateur mis à jour ✅');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || err?.message || 'Erreur mise à jour utilisateur');
      },
    });
  }

  // -----------------------------
  // Navigation
  // -----------------------------
  cancel(): void {
    this.router.navigate(['/admin/users']).then();
  }

  fieldError(name: string): string | null {
    const c = this.form.get(name);
    if (!c || !c.touched || !c.errors) return null;

    if (c.errors['required']) return 'Champ requis';
    if (c.errors['email']) return 'Email invalide';
    if (c.errors['minlength']) return `Min ${c.errors['minlength'].requiredLength} caractères`;

    return 'Valeur invalide';
  }

  onToggleAvailable(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.showOnlyAvailableVehicles.set(!!input?.checked);
  }


  protected readonly HTMLInputElement = HTMLInputElement;
}
