// app/modules/auth/login/login.ts
import {Component, inject, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {AuthService} from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [
    ReactiveFormsModule
  ],
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
    password: ['', Validators.required]
  });
  mfaForm: FormGroup = this.fb.group({
    code: ['', Validators.required]
  });
  setupForm: FormGroup = this.fb.group({
    code: ['', Validators.required]
  });
  passwordForm: FormGroup = this.fb.group({
    newPassword: ['', Validators.required],
    confirmPassword: ['', Validators.required],
    mfaCode: ['']
  });

  // --- Signaux ---
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  step = signal<'login' | 'mfa' | 'setup' | 'password'>('login');
  mfaToken = signal<string | null>(null);
  qrDataUrl = signal<string | null>(null);
  sharedSecret = signal<string | null>(null);
  private pendingEmail = signal<string | null>(null);
  private pendingPassword = signal<string | null>(null);

  constructor() {}

  // --- Soumission du formulaire ---
  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    const credentials = {
      email: this.form.value.email,
      password: this.form.value.password
    };

    this.auth.login(credentials).subscribe({
      next: (resp) => {
        this.loading.set(false);

        this.pendingEmail.set(String(credentials.email || '').trim());
        this.pendingPassword.set(String(credentials.password || ''));

        if (resp?.mfaRequired) {
          this.step.set('mfa');
          return;
        }

        if (resp?.mfaSetupRequired) {
          if (!resp.mfaToken) {
            this.error.set('Configuration MFA indisponible.');
            return;
          }
          this.mfaToken.set(resp.mfaToken);
          this.step.set('setup');
          this.loadMfaSetup(resp.mfaToken);
          return;
        }

        if (resp?.accessToken) {
          this.redirectAfterLogin();
          return;
        }

        this.error.set(resp?.message || 'Connexion refusée.');
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.error?.passwordExpired) {
          this.pendingEmail.set(String(credentials.email || '').trim());
          this.pendingPassword.set(String(credentials.password || ''));
          this.step.set('password');
          this.error.set(err?.error?.message || 'Mot de passe expiré.');
          return;
        }
        this.error.set(err?.error?.message || 'Identifiants invalides');
      }
    });
  }

  submitMfa(): void {
    if (this.mfaForm.invalid) return;
    const email = this.pendingEmail();
    const password = this.pendingPassword();
    if (!email || !password) return;

    this.loading.set(true);
    this.error.set(null);

    this.auth.login({ email, password, mfaCode: this.mfaForm.value.code }).subscribe({
      next: (resp) => {
        this.loading.set(false);
        if (resp?.accessToken) {
          this.redirectAfterLogin();
          return;
        }
        this.error.set(resp?.message || 'Code MFA invalide.');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Code MFA invalide.');
      }
    });
  }

  submitMfaSetup(): void {
    if (this.setupForm.invalid) return;
    const token = this.mfaToken();
    if (!token) return;

    this.loading.set(true);
    this.error.set(null);

    this.auth.verifyMfaSetup(token, this.setupForm.value.code).subscribe({
      next: (resp) => {
        this.loading.set(false);
        if (resp?.accessToken) {
          this.redirectAfterLogin();
          return;
        }
        this.error.set(resp?.message || 'Code MFA invalide.');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Code MFA invalide.');
      }
    });
  }

  submitPasswordChange(): void {
    if (this.passwordForm.invalid) return;
    const email = this.pendingEmail();
    const currentPassword = this.pendingPassword();
    if (!email || !currentPassword) return;

    const newPassword = String(this.passwordForm.value.newPassword || '');
    const confirm = String(this.passwordForm.value.confirmPassword || '');
    if (newPassword !== confirm) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.changePassword({
      email,
      currentPassword,
      newPassword,
      mfaCode: String(this.passwordForm.value.mfaCode || '').trim() || undefined
    }).subscribe({
      next: (resp) => {
        this.loading.set(false);
        if (resp?.success) {
          this.success.set('Mot de passe mis à jour. Vous pouvez vous connecter.');
          this.step.set('login');
          this.passwordForm.reset();
          return;
        }
        this.error.set(resp?.message || 'Erreur mise à jour mot de passe.');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur mise à jour mot de passe.');
      }
    });
  }

  backToLogin(): void {
    this.step.set('login');
    this.error.set(null);
    this.success.set(null);
    this.mfaToken.set(null);
    this.qrDataUrl.set(null);
    this.sharedSecret.set(null);
  }

  private loadMfaSetup(token: string): void {
    this.auth.startMfaSetup(token).subscribe({
      next: (resp) => {
        this.qrDataUrl.set(resp.qrDataUrl);
        this.sharedSecret.set(resp.secret);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Impossible de charger la configuration MFA.');
      }
    });
  }

  private redirectAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    const role = this.auth.getUserRole();

    if (role === 'GESTION_DEPOT') {
      this.router.navigate(['/depot']);
    } else if (role === 'TECHNICIEN') {
      this.router.navigate(['/unauthorized']);
    } else if (role === 'ADMIN' || role === 'DIRIGEANT') {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.router.navigateByUrl(returnUrl);
    }
  }
}
