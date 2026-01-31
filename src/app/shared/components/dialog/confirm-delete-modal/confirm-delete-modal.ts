// confirm-delete-modal.ts
import { Component, EventEmitter, Output, computed, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';
import { formatPersonName } from '../../../../core/utils/text-format';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-confirm-delete-modal',
  imports: [CommonModule],
  templateUrl: './confirm-delete-modal.html',
  styleUrls: ['./confirm-delete-modal.scss'],
})
export class ConfirmDeleteModal {
  private auth = inject(AuthService);
  /** Affiche/masque */
  readonly open = input(false);

  /** Libellé d’entité (ex: "utilisateur", "dépôt", "consommable", "matériel") */
  readonly entityLabel = input('élément');

  /** Nom affiché (ex: "Heidi HAMOU") */
  readonly entityName = input('');

  /** ID optionnel pour contexte */
  readonly entityId = input<string | null>(null);

  /** Auteur de la suppression (optionnel) */
  readonly authorName = input('');

  /** Texte d’avertissement */
  readonly dangerHint = input('Cette action est irréversible.');

  /** Titre de la modale */
  readonly title = input('Confirmer la suppression');

  /** Question personnalisée (remplace le texte par défaut si fourni) */
  readonly question = input<string | null>(null);

  /** Personnalisation boutons */
  readonly cancelText = input('Annuler');
  readonly confirmText = input('Supprimer');
  readonly confirmLoadingText = input('Suppression…');
  readonly confirmIcon = input('fa-solid fa-trash');

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

  readonly authorLabel = computed(() => {
    const inputName = this.authorName().trim();
    if (inputName) return inputName;
    const user = this.auth.getCurrentUser();
    if (!user) return '';
    const name = formatPersonName(user.firstName ?? '', user.lastName ?? '');
    return name || user.email || '';
  });
}
