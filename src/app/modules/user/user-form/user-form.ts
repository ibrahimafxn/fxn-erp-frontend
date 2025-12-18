import {Component, inject, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {UserService} from '../../../core/services/user.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.html',
  imports: [
    ReactiveFormsModule
  ],
  styleUrls: ['./user-form.scss']
})
export class UserForm{
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);

  form: FormGroup = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['', Validators.required]
  });

  // Signaux pour feedback
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // Soumission du formulaire
  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    const payload = this.form.value;


  }
}
