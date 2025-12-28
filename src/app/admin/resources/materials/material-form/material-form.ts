import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { MaterialService } from '../../../../core/services/material.service';
import { DepotService } from '../../../../core/services/depot.service';
import { Depot, Material } from '../../../../core/models';
import { MaterialCategory } from '../../../../core/models';
import {DetailBack} from '../../../../core/utils/detail-back';

type Mode = 'create' | 'edit';

@Component({
  standalone: true,
  selector: 'app-material-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './material-form.html',
  styleUrls: ['./material-form.scss'],
})
export class MaterialForm extends DetailBack {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  private materials = inject(MaterialService);
  private depotsSvc = inject(DepotService);

  // -----------------------------
  // Routing
  // /admin/resources/materials/new
  // /admin/resources/materials/:id/edit
  // -----------------------------
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly mode = computed<Mode>(() => (this.id ? 'edit' : 'create'));

  // -----------------------------
  // State
  // -----------------------------
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);
  readonly depotsError = signal<string | null>(null);

  readonly current = signal<Material | null>(null);

  // -----------------------------
  // Form (✅ correction category)
  // -----------------------------
  readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),

    // ✅ ICI : valeur initiale + validators séparés
    category: this.fb.nonNullable.control<MaterialCategory>(MaterialCategory.OUTIL, [Validators.required]),

    description: this.fb.nonNullable.control(''),
    quantity: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),

    // dépôt optionnel
    idDepot: this.fb.control<string | null>(null),
  });

  readonly title = computed(() => (this.mode() === 'create' ? 'Nouveau matériel' : 'Modifier matériel'));
  readonly canSubmit = computed(() => !this.saving() && this.form.valid);

  constructor() {
    super();
    this.loadDepots();
    if (this.mode() === 'edit') this.loadMaterial();
  }

  // -----------------------------
  // Depots (select)
  // -----------------------------
  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotsError.set(null);

    this.depotsSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: (err) => {
        this.depotsLoading.set(false);
        this.depotsError.set(err?.error?.message || 'Erreur chargement dépôts');
      },
    });
  }

  // -----------------------------
  // Load material (edit)
  // -----------------------------
  private loadMaterial(): void {
    if (!this.id) return;

    this.loading.set(true);
    this.error.set(null);

    this.materials.getById(this.id).subscribe({
      next: (mat) => {
        this.current.set(mat);

        // ✅ idDepot peut être string OU objet populate
        const depotId =
          typeof mat.idDepot === 'string'
            ? mat.idDepot
            : mat.idDepot && typeof mat.idDepot === 'object' && '_id' in mat.idDepot
              ? mat.idDepot._id
              : null;

        this.form.patchValue({
          name: mat.name ?? '',
          category: mat.category ?? MaterialCategory.OUTIL,
          description: mat.description ?? '',
          quantity: typeof mat.quantity === 'number' ? mat.quantity : 0,
          idDepot: depotId,
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement matériel');
      },
    });
  }

  // -----------------------------
  // Submit
  // -----------------------------
  submit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload = this.form.getRawValue(); // category est bien MaterialCategory, plus un tableau

    if (this.mode() === 'create') {
      this.materials.create(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/admin/resources/materials']).then();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Erreur création matériel');
        },
      });
      return;
    }

    // edit
    this.materials.update(this.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/admin/resources/materials']).then();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Erreur mise à jour matériel');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/resources/materials']).then();
  }

  // -----------------------------
  // Helpers template (0 any)
  // -----------------------------
  isInvalid(name: 'name' | 'category' | 'quantity' | 'idDepot' | 'description'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  protected readonly MaterialCategory = MaterialCategory;
}
