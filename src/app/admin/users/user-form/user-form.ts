import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';

import {UserService} from '../../../core/services/user.service';
import {User} from '../../../core/models';
import {Role} from '../../../core/models/roles.model';

@Component({
  standalone: true,
  selector: 'app-user-form',
  templateUrl: './user-form.html',
  styleUrls: ['./user-form.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterModule]
})
export class UserForm {
  private fb = inject(FormBuilder);
  private usersService = inject(UserService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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
  // Roles (doit matcher backend)
  // -----------------------------
  readonly roles = [
    { value: Role.DIRIGEANT, label: 'Dirigeant' },
    { value: Role.ADMIN, label: 'Administrateur' },
    { value: Role.GESTION_DEPOT, label: 'Gestion dépôt' },
    { value: Role.TECHNICIEN, label: 'Technicien' }
  ];

  // -----------------------------
  // Formulaire
  // -----------------------------
  readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: [Role.TECHNICIEN as any, [Validators.required]],

    /**
     * idDepot et assignedVehicle : optionnels, souvent renseignés plus tard
     * (on les laisse en champ texte pour le moment, tu mettras des selects plus tard)
     */
    idDepot: [''],
    assignedVehicle: ['']
  });

  constructor() {
    // Récupère l'id dans l’URL : /admin/users/:id
    const id = this.route.snapshot.paramMap.get('id');
    // Si id === "new" (au cas où), on ignore
    if (id && id !== 'new') {
      this.userId.set(id);
      this.loadUser(id);
    }
  }

  // -----------------------------
  // Chargement user (mode édition)
  // -----------------------------
  private loadUser(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.usersService.getUser(id).subscribe({
      next: (u: User) => {
        // Patch minimal : on ne patch pas password
        this.form.patchValue({
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: u.email || '',
          phone: u.phone || '',
          role: (u.role as any) || Role.TECHNICIEN,
          idDepot: (u as any).idDepot || '',
          assignedVehicle: (u as any).assignedVehicle || ''
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || err?.message || 'Erreur chargement utilisateur');
      }
    });
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

    // Prépare payload propre
    const raw = this.form.getRawValue();

    // On supprime les champs vides inutiles
    const payload: any = {
      firstName: raw.firstName?.trim(),
      lastName: raw.lastName?.trim() || undefined,
      email: raw.email?.trim()?.toLowerCase(),
      phone: raw.phone?.trim() || undefined,
      role: raw.role,

      idDepot: raw.idDepot?.trim() ? raw.idDepot.trim() : null,
      assignedVehicle: raw.assignedVehicle?.trim() ? raw.assignedVehicle.trim() : null
    };

    // CREATE
    if (!this.isEdit()) {
      this.usersService.createUser(payload).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.success.set(`Utilisateur créé : ${created.firstName} ${created.lastName || ''}`.trim());

          // Redirige vers la liste après création
          setTimeout(() => this.router.navigate(['/admin/users']), 400);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || err?.message || 'Erreur création utilisateur');
        }
      });
      return;
    }

    // UPDATE
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
      }
    });
  }

  // -----------------------------
  // Navigation
  // -----------------------------
  cancel(): void {
    this.router.navigate(['/admin/users']);
  }

  // Helpers template
  fieldError(name: string): string | null {
    const c = this.form.get(name);
    if (!c || !c.touched || !c.errors) return null;

    if (c.errors['required']) return 'Champ requis';
    if (c.errors['email']) return 'Email invalide';
    if (c.errors['minlength']) return `Min ${c.errors['minlength'].requiredLength} caractères`;

    return 'Valeur invalide';
  }
}
