import { Component, EventEmitter, Output, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-confirm-cancel-modal',
  imports: [CommonModule],
  templateUrl: './confirm-cancel-modal.html',
  styleUrls: ['./confirm-cancel-modal.scss'],
})
export class ConfirmCancelModal {
  readonly open = input(false);
  readonly title = input('Confirmer l’annulation');
  readonly entityLabel = input('transaction');
  readonly entityName = input('');
  readonly entityId = input<string | null>(null);
  readonly dangerHint = input('Cette action annulera la transaction.');
  readonly cancelText = input('Retour');
  readonly confirmText = input('Annuler');
  readonly confirming = input(false);
  readonly showReason = input(true);
  readonly reasonPlaceholder = input('Motif (optionnel)…');

  readonly reason = signal('');

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();

  onBackdropClick(): void {
    if (this.confirming()) return;
    this.resetReason();
    this.cancel.emit();
  }

  onCancel(): void {
    if (this.confirming()) return;
    this.resetReason();
    this.cancel.emit();
  }

  onConfirm(): void {
    if (this.confirming()) return;
    const value = this.reason().trim();
    if (this.showReason() && !value) return;
    this.resetReason();
    this.confirm.emit(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.confirming()) this.onCancel();
  }

  onReasonInput(event: Event): void {
    const el = event.target instanceof HTMLTextAreaElement ? event.target : null;
    if (!el) return;
    this.reason.set(el.value);
  }

  readonly displayName = computed(() => {
    const n = this.entityName().trim();
    return n ? `« ${n} »` : this.entityLabel();
  });

  private resetReason(): void {
    this.reason.set('');
  }
}
