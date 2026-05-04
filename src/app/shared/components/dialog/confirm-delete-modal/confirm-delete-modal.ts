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

  /** Auteur lié à l’action (optionnel) */
  readonly authorName = input('');

  /** Texte d’avertissement */
  readonly dangerHint = input('');

  /** Titre de la modale */
  readonly title = input('');

  /** Question personnalisée (remplace le texte par défaut si fourni) */
  readonly question = input<string | null>(null);

  /** Personnalisation boutons */
  readonly cancelText = input('Annuler');
  readonly confirmText = input('Supprimer');
  readonly confirmLoadingText = input('');
  readonly confirmIcon = input('');

  /** Si tu veux bloquer le bouton de confirmation pendant une requête */
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

  /** Texte affiché dans la question (label + nom si disponible) */
  readonly displaySubject = computed(() => {
    const label = this.trimmed(this.entityLabel());
    const name = this.trimmed(this.entityName());
    return name ? `${label} « ${name} »` : label;
  });

  readonly dialogTitle = computed(() => {
    const customTitle = this.trimmed(this.title());
    return customTitle || `Confirmer ${this.actionNoun(this.confirmText())}`;
  });

  readonly dialogQuestion = computed(() => {
    const customQuestion = this.trimmed(this.question());
    if (customQuestion) return customQuestion;

    const verb = this.trimmed(this.confirmText()).toLowerCase() || 'confirmer';
    return `Voulez-vous vraiment ${verb} ${this.displaySubject()} ?`;
  });

  readonly dialogDangerHint = computed(() => {
    const customHint = this.trimmed(this.dangerHint());
    if (customHint) return customHint;
    return this.isDeleteAction(this.confirmText())
      ? 'Cette action est irréversible.'
      : 'Vérifie les informations avant de continuer.';
  });

  readonly dialogConfirmText = computed(() => this.trimmed(this.confirmText()) || 'Confirmer');

  readonly dialogConfirmLoadingText = computed(() => {
    const customLoadingText = this.trimmed(this.confirmLoadingText());
    if (customLoadingText) return customLoadingText;
    return `${this.dialogConfirmText()}…`;
  });

  readonly dialogConfirmIcon = computed(() => {
    const customIcon = this.trimmed(this.confirmIcon());
    if (customIcon) return customIcon;
    return this.isDeleteAction(this.confirmText()) ? 'bi bi-trash' : 'bi bi-check2-circle';
  });

  private trimmed(value: string | null | undefined): string {
    return (value ?? '').trim();
  }

  private normalizeAction(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[’']/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private actionNoun(action: string): string {
    const key = this.normalizeAction(action);
    const nouns: Record<string, string> = {
      supprimer: 'la suppression',
      'supprimer definitivement': 'la suppression définitive',
      receptionner: 'la réception',
      transferer: 'le transfert',
      'mettre a jour': 'la mise à jour',
      valider: 'la validation',
      creer: 'la création',
      annuler: "l'annulation",
      refuser: 'le refus',
      approuver: "l'approbation",
      desactiver: 'la désactivation',
      activer: "l'activation",
      debloquer: 'le déblocage',
      reinitialiser: 'la réinitialisation',
      continuer: "l'opération",
      enregistrer: "l'enregistrement",
      importer: "l'import",
      exporter: "l'export",
      archiver: "l'archivage",
      restaurer: 'la restauration',
      fermer: 'la fermeture',
      ouvrir: "l'ouverture",
    };

    return nouns[key] || "l'action";
  }

  private isDeleteAction(action: string): boolean {
    const key = this.normalizeAction(action);
    return key === 'supprimer' || key === 'retirer' || key === 'effacer';
  }

  readonly authorLabel = computed(() => {
    const inputName = this.authorName().trim();
    if (inputName) return inputName;
    const user = this.auth.getCurrentUser();
    if (!user) return '';
    const name = formatPersonName(user.firstName ?? '', user.lastName ?? '');
    return name || user.email || '';
  });
}
