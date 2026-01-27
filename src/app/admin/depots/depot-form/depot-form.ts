import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DepotService } from '../../../core/services/depot.service';
import { UserService } from '../../../core/services/user.service';
import { Depot } from '../../../core/models';
import { User } from '../../../core/models';
import {DetailBack} from '../../../core/utils/detail-back';
import { formatPersonName } from '../../../core/utils/text-format';

type Mode = 'create' | 'edit';

/** Structure d’erreurs renvoyée par express-validator */
type ApiValidationError = {
  type?: string;
  msg?: string;
  path?: string;   // express-validator v7 utilise "path" (souvent) au lieu de "param"
  param?: string;  // parfois présent selon versions
  value?: any;
  location?: string;
};

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-depot-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './depot-form.html',
  styleUrls: ['./depot-form.scss']
})
export class DepotForm extends DetailBack {
  private fb = inject(FormBuilder);
  private depotService = inject(DepotService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  // -----------------------------
  // State
  // -----------------------------
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** Erreur globale (ex: 500, ou message générique) */
  readonly error = signal<string | null>(null);

  userName(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || u._id;
  }

  /**
   * Erreurs par champ (issues de express-validator)
   * Exemple: fieldErrors().name => "Le nom du dépôt est requis"
   */
  readonly fieldErrors = signal<Record<string, string>>({});

  // Managers
  readonly managersLoading = signal(false);
  readonly managersError = signal<string | null>(null);
  readonly managers = signal<User[]>([]);

  private depotId = this.route.snapshot.paramMap.get('id') || '';
  readonly mode = signal<Mode>(this.depotId ? 'edit' : 'create');
  readonly title = computed(() => (this.mode() === 'create' ? 'Nouveau dépôt' : 'Modifier le dépôt'));

  // -----------------------------
  // Form
  // -----------------------------
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    city: [''],
    address: [''],
    phone: [''],
    managerId: [''] // '' ou ObjectId
  });

  constructor() {
    super();
    this.loadManagers();

    if (this.mode() === 'edit') {
      this.loadDepot();
    }
  }

  // -----------------------------
  // Helpers Template
  // -----------------------------
  isCreate(): boolean { return this.mode() === 'create'; }
  isEdit(): boolean { return this.mode() === 'edit'; }

  canSubmit(): boolean {
    return this.form.valid && !this.saving();
  }

  /** Récupère l’erreur d’un champ */
  fe(field: string): string | null {
    return this.fieldErrors()[field] || null;
  }

  /** Reset erreurs (global + champs) */
  private clearErrors(): void {
    this.error.set(null);
    this.fieldErrors.set({});
  }

  // -----------------------------
  // Load managers
  // -----------------------------
  loadManagers(): void {
    this.managersLoading.set(true);
    this.managersError.set(null);

    this.userService.refreshUsers(true, { role: 'GESTION_DEPOT,ADMIN,DIRIGEANT', page: 1, limit: 200 }).subscribe({
      next: result => {
        this.managers.set(result.items || []);
        this.managersLoading.set(false);
      },
      error: err => {
        this.managersLoading.set(false);
        this.managersError.set(err?.error?.message || 'Erreur chargement gestionnaires');
      }
    });
  }

  // -----------------------------
  // Load depot (edit)
  // -----------------------------
  private loadDepot(): void {
    if (!this.depotId) return;

    this.loading.set(true);
    this.clearErrors();

    this.depotService.getDepot(this.depotId).subscribe({
      next: (d: Depot) => {
        this.loading.set(false);

        // managerId peut être populate object ou string
        const m = (d as any).managerId;
        const managerId = m && typeof m === 'object' ? (m._id || '') : (m || '');

        this.form.patchValue({
          name: d.name || '',
          city: d.city || '',
          address: d.address || '',
          phone: d.phone || '',
          managerId: managerId || ''
        });
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement dépôt');
      }
    });
  }

  // -----------------------------
  // Submit
  // -----------------------------
  submit(): void {
    if (!this.canSubmit()) return;

    this.saving.set(true);
    this.clearErrors();

    const raw = this.form.getRawValue();

    const payload: Partial<Depot> = {
      name: (raw.name || '').trim(),
      city: (raw.city || '').trim(),
      address: (raw.address || '').trim(),
      phone: (raw.phone || '').trim(),
      managerId: raw.managerId ? raw.managerId : undefined
    };

    const request$ = this.isCreate()
      ? this.depotService.createDepot(payload)
      : this.depotService.updateDepot(this.depotId, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);

        // refresh liste
        this.depotService.clearCache();
        this.depotService.refreshDepots(true).subscribe({ next: () => {}, error: () => {} });

        this.router.navigate(['/admin/depots']);
      },
      error: err => {
        this.saving.set(false);
        this.applyApiErrors(err);
      }
    });
  }

  // -----------------------------
  // Mapping erreurs backend -> UI
  // -----------------------------
  private applyApiErrors(err: any): void {
    // cas classique: { success:false, message, errors:[...] }
    const api = err?.error;

    // Erreur validations champs (express-validator)
    const errors: ApiValidationError[] = api?.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of errors) {
        const key = (e.path || e.param || '').toString();
        if (key && e.msg) map[key] = e.msg;
      }
      this.fieldErrors.set(map);

      // message global utile (optionnel)
      this.error.set(api?.message || 'Certains champs sont invalides.');
      return;
    }

    // Erreurs non-field (duplicate key, 500, etc.)
    this.error.set(api?.message || err?.message || 'Erreur lors de l’enregistrement');
  }
}
