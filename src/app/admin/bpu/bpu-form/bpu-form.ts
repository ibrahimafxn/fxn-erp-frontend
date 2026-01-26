import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BpuService } from '../../../core/services/bpu.service';

type Segment = 'AUTO' | 'SALARIE';

@Component({
  standalone: true,
  selector: 'app-bpu-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './bpu-form.html',
  styleUrl: './bpu-form.scss'
})
export class BpuForm {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private bpuService = inject(BpuService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    segment: this.fb.nonNullable.control<Segment>('AUTO'),
    prestation: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    code: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    unitPrice: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)])
  });

  readonly canSubmit = computed(() => !this.saving() && this.form.valid);

  submit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.bpuService.upsert({
      segment: payload.segment,
      prestation: payload.prestation.trim(),
      code: payload.code.trim().toUpperCase(),
      unitPrice: Number(payload.unitPrice || 0)
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/admin/bpu/prestations/new']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.apiError(err, 'Erreur sauvegarde BPU'));
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/bpu/prestations/new']);
  }

  isInvalid(name: 'segment' | 'prestation' | 'code' | 'unitPrice'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
