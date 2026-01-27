import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BpuTypeService } from '../../../core/services/bpu-type.service';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-bpu-type-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './bpu-type-form.html',
  styleUrl: './bpu-type-form.scss'
})
export class BpuTypeForm {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private svc = inject(BpuTypeService);

  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)])
  });

  readonly canSubmit = computed(() => !this.saving() && !this.loading() && this.form.valid);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editingId.set(id);
      this.load(id);
    }
  }

  load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.getOne(id).subscribe({
      next: (item) => {
        this.form.patchValue({ type: item.type || '' });
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.apiError(err, 'Erreur chargement BPU'));
        this.loading.set(false);
      }
    });
  }

  submit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = { type: this.form.getRawValue().type.trim() };
    this.saving.set(true);
    this.error.set(null);

    const id = this.editingId();
    const request = id ? this.svc.update(id, payload) : this.svc.create(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/admin/bpu']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.apiError(err, 'Erreur sauvegarde BPU'));
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/bpu']);
  }

  isInvalid(name: 'type'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  title(): string {
    return this.editingId() ? 'Modifier BPU' : 'Nouveau BPU';
  }

  subtitle(): string {
    return this.editingId()
      ? 'Mettre à jour le type de BPU.'
      : 'Créer un nouveau type de BPU.';
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
