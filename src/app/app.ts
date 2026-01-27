import { Component, AfterViewInit, OnDestroy, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {AppHeader} from './layout/app-header/app-header';
import {AuthService} from './core/services/auth.service';
import {Role} from './core/models/roles.model';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AppHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private toneObserver: MutationObserver | null = null;

  protected readonly title = signal('fxn-erp-frontend');

  private readonly themeEffect = effect(() => {
    const role = this.auth.getUserRole();
    const body = this.document.body;
    const classes = ['theme-default', 'theme-admin', 'theme-dirigeant', 'theme-gestion-depot', 'theme-technicien'];

    classes.forEach(c => body.classList.remove(c));

    switch (role) {
      case Role.ADMIN:
        body.classList.add('theme-admin');
        break;
      case Role.DIRIGEANT:
        body.classList.add('theme-dirigeant');
        break;
      case Role.GESTION_DEPOT:
        body.classList.add('theme-gestion-depot');
        break;
      case Role.TECHNICIEN:
        body.classList.add('theme-technicien');
        break;
      default:
        body.classList.add('theme-default');
        break;
    }
  });

  ngAfterViewInit(): void {
    this.applyButtonTones();
    this.toneObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === 'BUTTON') {
            this.applyTone(node as HTMLButtonElement);
            return;
          }
          const buttons = node.querySelectorAll?.('button') ?? [];
          buttons.forEach((btn) => this.applyTone(btn as HTMLButtonElement));
        });
      }
    });
    this.toneObserver.observe(this.document.body, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.toneObserver?.disconnect();
    this.toneObserver = null;
  }

  private applyButtonTones(): void {
    this.document.querySelectorAll('button').forEach((btn) => this.applyTone(btn as HTMLButtonElement));
  }

  private applyTone(button: HTMLButtonElement): void {
    const hasBtnClass = Array.from(button.classList).some((c) => c.startsWith('btn-'));
    if (!hasBtnClass) return;

    const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    const lower = text
      .toLowerCase()
      .replace(/[←→]/g, '')
      .replace(/\u2026/g, '')
      .trim();

    const tones = [
      'btn-tone-danger',
      'btn-tone-success',
      'btn-tone-primary',
      'btn-tone-info',
      'btn-tone-neutral',
      'btn-tone-export-pdf',
      'btn-tone-export-csv',
      'btn-tone-flat',
      'btn-tone-new',
      'btn-tone-outline-primary',
      'btn-tone-outline-danger',
      'btn-tone-outline-success',
      'btn-tone-outline-neutral'
    ];
    tones.forEach((tone) => button.classList.remove(tone));

    if (lower.includes('exporter pdf')) {
      button.classList.add('btn-tone-export-pdf');
      return;
    }
    if (lower.includes('exporter csv') || lower.includes('exporter excel')) {
      button.classList.add('btn-tone-export-csv');
      return;
    }
    if (lower.includes('importer') || lower.includes('exporter')) return;

    const isMatch = (keywords: string[]) => keywords.some((k) => lower.includes(k));

    if (isMatch(['supprimer'])) {
      return;
    }
    if (isMatch(['désactiver', 'rejeter', 'retirer', 'reset'])) {
      button.classList.add('btn-tone-danger');
      return;
    }
    if (isMatch(['enregistrer', 'valider', 'confirmer', 'créer', 'approuver', 'activer'])) {
      button.classList.add('btn-tone-success');
      return;
    }
    if (isMatch(['nouveau'])) {
      button.classList.add('btn-tone-new');
      return;
    }
    if (isMatch(['reprendre'])) {
      button.classList.add('btn-tone-outline-neutral');
      return;
    }
    if (isMatch(['effacer'])) {
      button.classList.add('btn-tone-outline-danger');
      return;
    }
    if (isMatch(['réserver'])) {
      button.classList.add('btn-tone-outline-success');
      return;
    }
    if (isMatch(['ajouter', 'assigner', 'attribuer', 'déclarer', 'marquer', 'connecter'])) {
      button.classList.add('btn-tone-primary');
      return;
    }
    if (isMatch(['rechercher'])) {
      button.classList.add('btn-tone-outline-primary');
      return;
    }
    if (isMatch(['rafraîchir'])) {
      button.classList.add('btn-tone-primary');
      return;
    }
    if (isMatch(['voir', 'recharger', 'actualiser', 'télécharger', 'afficher', 'masquer', 'réessayer'])) {
      button.classList.add('btn-tone-info');
      return;
    }
    if (isMatch(['annuler', 'fermer', 'retour', 'précédent', 'suivant', 'effacer', 'réinitialiser', 'déconnexion', 'revenir'])) {
      button.classList.add('btn-tone-neutral');
      return;
    }
  }
}
