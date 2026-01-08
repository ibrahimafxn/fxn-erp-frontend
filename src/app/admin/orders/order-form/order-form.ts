import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { OrderService } from '../../../core/services/order.service';

@Component({
  standalone: true,
  selector: 'app-order-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './order-form.html',
  styleUrls: ['./order-form.scss']
})
export class OrderForm {
  private fb = inject(FormBuilder);
  private orders = inject(OrderService);
  private router = inject(Router);

  readonly saving = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    reference: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    client: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    date: this.fb.nonNullable.control('', [Validators.required]),
    status: this.fb.nonNullable.control('', [Validators.required]),
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    notes: this.fb.nonNullable.control('')
  });

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      reference: raw.reference.trim(),
      client: raw.client.trim(),
      date: raw.date,
      status: raw.status.trim(),
      amount: Number(raw.amount),
      notes: raw.notes.trim() || undefined
    };

    this.orders.create(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        const id = res?.data?._id || (res?.data as { id?: string } | undefined)?.id || '';
        if (!id) {
          this.submitSuccess.set('Commande creee, ID manquant.');
          this.router.navigate(['/admin/orders']).then();
          return;
        }
        this.submitSuccess.set('Commande creee.');
        this.router.navigate(['/admin/orders', id, 'detail']).then();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.submitError.set(apiMsg || err.message || 'Erreur creation commande');
      }
    });
  }
}
