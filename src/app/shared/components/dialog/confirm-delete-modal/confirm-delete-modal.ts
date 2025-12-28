// confirm-delete-modal.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input({ required: true }) open = false;

  /** Libellé d’entité (ex: "utilisateur", "dépôt", "consommable", "matériel") */
  @Input() entityLabel = 'élément';

  /** Nom affiché (ex: "Heidi HAMOU") */
  @Input() entityName = '';

  /** ID optionnel pour contexte */
  @Input() entityId: string | null = null;

  /** Texte d’avertissement */
  @Input() dangerHint = 'Cette action est irréversible.';

  /** Personnalisation boutons */
  @Input() cancelText = 'Annuler';
  @Input() confirmText = 'Supprimer';

  /** Si tu veux bloquer le bouton "Supprimer" pendant une requête */
  @Input() confirming = false;

  /** Events */
  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onBackdropClick(): void {
    this.cancel.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onConfirm(): void {
    if (this.confirming) return;
    this.confirm.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.cancel.emit();
  }

  /** Texte affiché si le nom est vide */
  displayName(): string {
    const n = this.entityName.trim();
    return n ? `« ${n} »` : this.entityLabel;
  }
}
