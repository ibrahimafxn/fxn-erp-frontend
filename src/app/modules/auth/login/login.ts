// app/modules/auth/login/login.ts
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Valide que le champ contient au moins 1 majuscule et 1 chiffre. */
const passwordStrengthValidator: ValidatorFn = (ctrl: AbstractControl): ValidationErrors | null => {
  const v: string = ctrl.value ?? '';
  if (!v) return null;
  if (v.length < 8) return { tooShort: true };
  if (!/[A-Z]/.test(v)) return { noUppercase: true };
  if (!/[0-9]/.test(v)) return { noDigit: true };
  return null;
};

/** Valide que newPassword === confirmPassword au niveau du groupe. */
const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const np = group.get('newPassword')?.value ?? '';
  const cp = group.get('confirmPassword')?.value ?? '';
  return np && cp && np !== cp ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  imports: [ReactiveFormsModule],
  styleUrls: ['./login.scss']
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  // --- Formulaires réactifs ---
  form: FormGroup = this.fb.group({
    email: ['', Validators.required],
    password: ['', Validators.required],
    mfaCode: [''],
    rememberDevice: [true]
  });

  passwordForm: FormGroup = this.fb.group(
    {
      newPassword: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
      mfaCode: ['']
    },
    { validators: passwordMatchValidator }
  );

  // --- Signaux ---
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  step = signal<'login' | 'password'>('login');
  mfaRequired = signal(false);
  showPassword = signal(false);
  showNewPassword = signal(false);
  showRememberDevice = signal(false);
  readonly currentLocale = signal<'fr' | 'en'>('fr');
  private pendingEmail = signal<string | null>(null);
  private pendingPassword = signal<string | null>(null);

  constructor() {
    this.currentLocale.set(this.detectLocale());
    this.auth.ensureSessionReady().subscribe(() => {
      if (this.auth.isAuthenticated()) {
        this.redirectAfterLogin();
      }
    });
  }

  // --- Helpers erreurs formulaire ---
  get newPasswordErrors(): string | null {
    const ctrl = this.passwordForm.get('newPassword');
    if (!ctrl?.dirty && !ctrl?.touched) return null;
    if (ctrl.errors?.['required']) return 'Mot de passe requis.';
    if (ctrl.errors?.['tooShort']) return 'Minimum 8 caractères.';
    if (ctrl.errors?.['noUppercase']) return 'Au moins 1 lettre majuscule.';
    if (ctrl.errors?.['noDigit']) return 'Au moins 1 chiffre.';
    return null;
  }

  get confirmPasswordErrors(): string | null {
    const ctrl = this.passwordForm.get('confirmPassword');
    if (!ctrl?.dirty && !ctrl?.touched) return null;
    if (ctrl.errors?.['required']) return 'Confirmation requise.';
    if (this.passwordForm.errors?.['passwordMismatch']) return 'Les mots de passe ne correspondent pas.';
    return null;
  }

  // --- Soumission login ---
  submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    const credentials = {
      email: String(this.form.value.email ?? '').trim(),
      password: String(this.form.value.password ?? ''),
      mfaCode: String(this.form.value.mfaCode ?? '').trim() || undefined,
      rememberDevice: Boolean(this.form.value.rememberDevice)
    };

    this.auth.login(credentials).subscribe({
      next: (resp) => {
        this.loading.set(false);

        this.pendingEmail.set(credentials.email);
        this.pendingPassword.set(credentials.password);

        if (resp?.mfaRequired) {
          this.mfaRequired.set(true);
          return;
        }

        if (resp?.accessToken) {
          this.mfaRequired.set(false);
          this.redirectAfterLogin();
          return;
        }

        this.mfaRequired.set(false);
        this.error.set(resp?.message ?? 'Connexion refusée.');
      },
      error: (err) => {
        this.loading.set(false);

        if (err?.error?.passwordExpired) {
          this.pendingEmail.set(credentials.email);
          this.pendingPassword.set(credentials.password);
          this.step.set('password');
          this.mfaRequired.set(false);
          this.error.set(
            err?.error?.mustChangePassword
              ? 'Votre mot de passe doit être changé avant de continuer.'
              : (err?.error?.message ?? 'Mot de passe expiré.')
          );
          return;
        }

        if (err?.error?.mfaRequired) {
          this.mfaRequired.set(true);
          this.error.set(err?.error?.message ?? 'Code MFA requis.');
          return;
        }

        this.mfaRequired.set(false);
        this.error.set(err?.error?.message ?? 'Identifiants invalides.');
      }
    });
  }

  // --- Soumission changement de mot de passe ---
  submitPasswordChange(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;

    const email = this.pendingEmail();
    const currentPassword = this.pendingPassword();
    if (!email || !currentPassword) {
      this.error.set('Session expirée. Veuillez recommencer depuis la page de connexion.');
      this.step.set('login');
      return;
    }

    const newPassword = String(this.passwordForm.value.newPassword ?? '');

    this.loading.set(true);
    this.error.set(null);

    this.auth.changePassword({
      email,
      currentPassword,
      newPassword,
      mfaCode: String(this.passwordForm.value.mfaCode ?? '').trim() || undefined
    }).subscribe({
      next: (resp) => {
        this.loading.set(false);
        if (resp?.success) {
          // Pré-remplir le formulaire login avec le nouveau mot de passe
          this.form.patchValue({ email, password: newPassword, mfaCode: '' });
          this.pendingPassword.set(newPassword);
          this.passwordForm.reset();
          this.mfaRequired.set(false);
          this.success.set('Mot de passe mis à jour. Cliquez sur Se connecter pour continuer.');
          this.step.set('login');
          return;
        }
        this.error.set(resp?.message ?? 'Erreur lors de la mise à jour du mot de passe.');
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.error?.mfaRequired) {
          this.mfaRequired.set(true);
        }
        this.error.set(err?.error?.message ?? 'Erreur lors de la mise à jour du mot de passe.');
      }
    });
  }

  backToLogin(): void {
    this.step.set('login');
    this.error.set(null);
    this.success.set(null);
    this.mfaRequired.set(false);
    this.passwordForm.reset();
    this.form.patchValue({ mfaCode: '' });
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleNewPassword(): void {
    this.showNewPassword.update((v) => !v);
  }

  localeHref(locale: 'fr' | 'en'): string {
    const path = window.location.pathname || '/';
    const normalized = path.startsWith('/en/')
      ? path.slice(3)
      : path === '/en'
        ? '/'
        : path;
    const base = locale === 'en' ? `/en${normalized === '/' ? '' : normalized}` : (normalized || '/');
    return `${base}${window.location.search ?? ''}${window.location.hash ?? ''}`;
  }

  private redirectAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    const role = this.auth.getUserRole();

    const defaults: Record<string, string> = {
      GESTION_DEPOT: '/depot',
      TECHNICIEN: '/technician',
      ADMIN: '/admin/dashboard',
      DIRIGEANT: '/admin/dashboard'
    };

    const allowedPrefixes: Record<string, string[]> = {
      GESTION_DEPOT: ['/depot'],
      TECHNICIEN: ['/technician'],
      ADMIN: ['/admin'],
      DIRIGEANT: ['/admin']
    };

    const safeDefault = defaults[role ?? ''] ?? '/';
    const prefixes = allowedPrefixes[role ?? ''] ?? [];
    const isReturnAllowed = prefixes.some((prefix) => returnUrl.startsWith(prefix));

    this.router.navigateByUrl(isReturnAllowed ? returnUrl : safeDefault);
  }

  private detectLocale(): 'fr' | 'en' {
    const path = window.location.pathname || '';
    return path === '/en' || path.startsWith('/en/') ? 'en' : 'fr';
  }
}
