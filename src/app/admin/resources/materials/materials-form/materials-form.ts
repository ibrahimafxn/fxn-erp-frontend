import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { MaterialService } from '../../../../core/services/material.service';
import { DepotService } from '../../../../core/services/depot.service';
import {Depot, DepotLite, Material} from '../../../../core/models';
import { MaterialCategory } from '../../../../core/models/MaterialCategory.model';

type Mode = 'create' | 'edit';

@Component({
  standalone: true,
  selector: 'app-materials-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './materials-form.html',
  styleUrls: ['./materials-form.scss'],
})
export class MaterialsForm {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private materialService = inject(MaterialService);
  private depotsSvc = inject(DepotService);

  // -----------------------------
  // Routing (id piloté par signal)
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
  // Form (✅ category bien typé)
  // -----------------------------
  readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    category: this.fb.nonNullable.control<MaterialCategory>(MaterialCategory.OUTIL, [Validators.required]),
    description: this.fb.nonNullable.control(''),
    quantity: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    idDepot: this.fb.control<string | null>(null),
  });

  readonly title = computed(() =>
    this.mode() === 'create' ? 'Nouveau matériel' : 'Modifier matériel'
  );

  canSubmit(): boolean {
    return !this.saving() && this.form.valid;
  }

  constructor() {
    this.loadDepots();
    if (this.mode() === 'edit') this.loadMaterial();
  }

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

  private loadMaterial(): void {
    this.loading.set(true);
    this.error.set(null);

    this.materialService.getById(this.id).subscribe({
      next: (mat) => {
        this.current.set(mat);

        function isDepotLite(v: unknown): v is DepotLite {
          return !!v && typeof v === 'object' && '_id' in v;
        }

        const depotId =
          typeof mat.idDepot === 'string'
            ? mat.idDepot
            : isDepotLite(mat.idDepot)
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

  submit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload = this.form.getRawValue();

    if (this.mode() === 'create') {
      this.materialService.create(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.materialService.clearCache();
          this.router.navigate(['/admin/resources/materials']);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Erreur création matériel');
        },
      });
      return;
    }

    // edit
    this.materialService.update(this.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.materialService.clearCache();
        this.router.navigate(['/admin/resources/materials']);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Erreur mise à jour matériel');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/resources/materials']);
  }

  isInvalid(name: 'name' | 'category' | 'quantity' | 'idDepot'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

}
