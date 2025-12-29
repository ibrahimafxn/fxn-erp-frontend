import { inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Classe de base pour les pages "Detail".
 * Objectif : bouton "Retour" = revient à la page précédente (history.back()).
 * Fallback : si pas d'historique, redirige vers une route safe.
 */
export abstract class DetailBack {
  protected readonly location = inject(Location);
  protected readonly router = inject(Router);

  /**
   * Retour à la page précédente.
   * - SPA-friendly : respecte le parcours utilisateur.
   * - Fallback : si arrivée directe (pas d'historique), on redirige vers une route.
   */
  back(fallbackUrl: string = '/admin/dashboard'): void {
    // history.length varie selon navigateur mais c'est un bon garde-fou
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    const resolvedFallback = fallbackUrl || (this.router.url.startsWith('/depot') ? '/depot' : '/admin/dashboard');
    this.router.navigateByUrl(resolvedFallback).then();
  }
}
