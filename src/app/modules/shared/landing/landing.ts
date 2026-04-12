import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './landing.html',
  styleUrls: ['./landing.scss']
})
export class Landing {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', Validators.required],
    password: ['', Validators.required],
    mfaCode: ['']
  });

  loading = signal(false);
  error = signal<string | null>(null);
  mfaRequired = signal(false);
  showPassword = signal(false);
  activeFocus = signal<'materiels' | 'flotte' | null>(null);

  constructor() {
    this.auth.ensureSessionReady().subscribe(() => {
      if (this.auth.isAuthenticated()) {
        this.router.navigateByUrl('/app');
      }
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const credentials = {
      email: String(this.form.value.email || '').trim(),
      password: String(this.form.value.password || ''),
      mfaCode: String(this.form.value.mfaCode || '').trim() || undefined,
      rememberDevice: true
    };

    this.auth.login(credentials).subscribe({
      next: (resp) => {
        this.loading.set(false);
        if (resp?.mfaRequired) {
          this.mfaRequired.set(true);
          return;
        }
        if (resp?.accessToken) {
          this.mfaRequired.set(false);
          this.router.navigateByUrl('/app');
          return;
        }
        this.mfaRequired.set(false);
        this.error.set(resp?.message || 'Connexion refusée.');
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.error?.passwordExpired) {
          this.error.set(err?.error?.message || 'Mot de passe expiré. Utilisez l’accès complet.');
          return;
        }
        if (err?.error?.mfaRequired) {
          this.mfaRequired.set(true);
          this.error.set(err?.error?.message || 'Code MFA requis.');
          return;
        }
        this.mfaRequired.set(false);
        this.error.set(err?.error?.message || 'Identifiants invalides.');
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleFocus(key: 'materiels' | 'flotte'): void {
    this.activeFocus.update((current) => (current === key ? null : key));
  }

  goToApp(): void {
    this.router.navigateByUrl('/app');
  }
}
