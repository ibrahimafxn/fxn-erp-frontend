import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PrestationService } from '../../../core/services/prestation.service';
import { Prestation } from '../../../core/models';
import { DetailBack } from '../../../core/utils/detail-back';

type Mode = 'create' | 'edit';

type ApiValidationError = {
  type?: string;
  msg?: string;
  path?: string;
  param?: string;
  value?: any;
  location?: string;
};

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-prestation-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './prestation-form.html',
  styleUrls: ['./prestation-form.scss']
})
export class PrestationForm extends DetailBack {
  private fb = inject(FormBuilder);
  private prestationService = inject(PrestationService);
  private route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  private prestationId = this.route.snapshot.paramMap.get('id') || '';
  readonly mode = signal<Mode>(this.prestationId ? 'edit' : 'create');
  readonly title = computed(() =>
    this.mode() === 'create' ? 'Nouvelle prestation' : 'Modifier la prestation'
  );

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(1)]],
    designation: ['', [Validators.required, Validators.minLength(2)]],
    prix: [null as number | null]
  });

  constructor() {
    super();
    if (this.mode() === 'edit') {
      this.loadPrestation();
    }
  }

  isCreate(): boolean { return this.mode() === 'create'; }
  isEdit(): boolean { return this.mode() === 'edit'; }
  canSubmit(): boolean { return this.form.valid && !this.saving(); }

  fe(field: string): string | null {
    return this.fieldErrors()[field] || null;
  }

  private clearErrors(): void {
    this.error.set(null);
    this.fieldErrors.set({});
  }

  private loadPrestation(): void {
    if (!this.prestationId) return;
    this.loading.set(true);
    this.clearErrors();

    this.prestationService.getPrestation(this.prestationId).subscribe({
      next: (p: Prestation) => {
        this.loading.set(false);
        this.form.patchValue({
          code: p.code || '',
          designation: p.designation || '',
          prix: p.prix ?? null
        });
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement prestation');
      }
    });
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.clearErrors();

    const raw = this.form.getRawValue();
    const payload: Partial<Prestation> = {
      code: (raw.code || '').trim().toUpperCase(),
      designation: (raw.designation || '').trim(),
      prix: raw.prix !== null && raw.prix !== undefined && String(raw.prix) !== '' ? Number(raw.prix) : null
    };

    const request$ = this.isCreate()
      ? this.prestationService.createPrestation(payload)
      : this.prestationService.updatePrestation(this.prestationId, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.prestationService.clearCache();
        this.router.navigate(['/admin/prestations']);
      },
      error: err => {
        this.saving.set(false);
        this.applyApiErrors(err);
      }
    });
  }

  private applyApiErrors(err: any): void {
    const api = err?.error;
    const errors: ApiValidationError[] = api?.errors;

    if (Array.isArray(errors) && errors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of errors) {
        const key = (e.path || e.param || '').toString();
        if (key && e.msg) map[key] = e.msg;
      }
      this.fieldErrors.set(map);
      this.error.set(api?.message || 'Certains champs sont invalides.');
      return;
    }

    this.error.set(api?.message || err?.message || "Erreur lors de l'enregistrement");
  }
}
