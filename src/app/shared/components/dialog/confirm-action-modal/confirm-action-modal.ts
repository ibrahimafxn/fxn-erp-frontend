import { Component, EventEmitter, Output, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-confirm-action-modal',
  imports: [CommonModule],
  templateUrl: './confirm-action-modal.html',
  styleUrls: ['./confirm-action-modal.scss'],
})
export class ConfirmActionModal {
  readonly open = input(false);
  readonly title = input('Confirmer');
  readonly message = input('Confirmer cette action ?');
  readonly confirmText = input('Confirmer');
  readonly cancelText = input('Annuler');
  readonly confirming = input(false);
  readonly tone = input<'primary' | 'danger' | 'success'>('primary');

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onBackdropClick(): void {
    if (this.confirming()) return;
    this.cancel.emit();
  }

  onCancel(): void {
    if (this.confirming()) return;
    this.cancel.emit();
  }

  onConfirm(): void {
    if (this.confirming()) return;
    this.confirm.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.confirming()) this.cancel.emit();
  }
}
