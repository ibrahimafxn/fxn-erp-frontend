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

  // --- Formulaire réactif ---
  form: FormGroup = this.fb.group({
    email: ['', Validators.required],
    password: ['', Validators.required]
  });

  // --- Signaux ---
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {}

  // --- Soumission du formulaire ---
  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    const credentials = {
      email: this.form.value.email,
      password: this.form.value.password
    };

    this.auth.login(credentials).subscribe({
      next: () => {
        this.loading.set(false);

        // redirection après login
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        const role = this.auth.getUserRole();

        // redirection par rôle (exemple)
        if (role === 'GESTION_DEPOT' || role === 'TECHNICIEN') {
          this.router.navigate(['/depot']);
        } else if (role === 'ADMIN' || role === 'DIRIGEANT') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigateByUrl(returnUrl);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Identifiants invalides');
      }
    });
  }
}
