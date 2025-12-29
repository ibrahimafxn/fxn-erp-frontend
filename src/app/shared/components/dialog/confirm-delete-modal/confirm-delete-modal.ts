// confirm-delete-modal.ts
import { Component, EventEmitter, Output, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-confirm-delete-modal',
  imports: [CommonModule],
  templateUrl: './confirm-delete-modal.html',
  styleUrls: ['./confirm-delete-modal.scss'],
})
export class ConfirmDeleteModal {
  /** Affiche/masque */
  readonly open = input(false);

  /** Libellé d’entité (ex: "utilisateur", "dépôt", "consommable", "matériel") */
  readonly entityLabel = input('élément');

  /** Nom affiché (ex: "Heidi HAMOU") */
  readonly entityName = input('');

  /** ID optionnel pour contexte */
  readonly entityId = input<string | null>(null);

  /** Texte d’avertissement */
  readonly dangerHint = input('Cette action est irréversible.');

  /** Personnalisation boutons */
  readonly cancelText = input('Annuler');
  readonly confirmText = input('Supprimer');

  /** Si tu veux bloquer le bouton "Supprimer" pendant une requête */
  readonly confirming = input(false);

  /** Events */
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

  /** Texte affiché si le nom est vide */
  readonly displayName = computed(() => {
    const n = this.entityName().trim();
    return n ? `« ${n} »` : this.entityLabel();
  });
}
