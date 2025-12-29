import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../core/models';

/**
 * Modal générique :
 * - activer accès (setAccess)
 * - reset mot de passe (resetPassword)
 */
@Component({
  standalone: true,
  selector: 'app-access-credentials-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './access-credentials-modal.html',
  styleUrls: ['./access-credentials-modal.scss'],
})
export class AccessCredentialsModal {
  private fb = inject(FormBuilder);

  readonly open = input(false);
  readonly mode = input<'enable' | 'reset'>('enable');
  readonly user = input<User | null>(null);

  readonly saving = input(false);
  readonly error = input<string | null>(null);

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<{ password: string; mustChangePassword: boolean }>();

  readonly form = this.fb.nonNullable.group({
    password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(8)]),
    mustChangePassword: this.fb.nonNullable.control(true),
  });

  readonly title = computed(() => (this.mode() === 'reset' ? 'Réinitialiser mot de passe' : 'Activer l’accès'));
  readonly userLabel = computed(() => {
    const u = this.user();
    if (!u) return '—';
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return name || u.email || u._id;
  });

  onBackdropClick(): void {
    if (this.saving()) return;
    this.cancel.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.saving()) this.cancel.emit();
  }

  /** Génère un mot de passe simple (admin peut modifier) */
  generate(): void {
    const rnd = () => Math.random().toString(36).slice(2, 6);
    const pass = `FxN-${rnd()}-${rnd()}!`;
    this.form.controls.password.setValue(pass);
    this.form.controls.password.markAsDirty();
  }

  copyPassword(): void {
    const p = this.form.controls.password.value;
    if (!p) return;
    navigator.clipboard?.writeText(p).catch(() => {});
  }

  onMustChangePasswordChange(event: Event): void {
    const el = event.target as HTMLInputElement | null;
    const checked = !!el?.checked;
    this.form.controls.mustChangePassword.setValue(checked);
  }

  submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirm.emit(this.form.getRawValue());
  }
}
