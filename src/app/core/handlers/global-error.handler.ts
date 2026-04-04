import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  handleError(error: unknown): void {
    // Erreurs HTTP : déjà gérées par l'intercepteur, on laisse passer
    if (error instanceof HttpErrorResponse) {
      console.error('[HTTP Error]', error.status, error.url, error.message);
      return;
    }

    // Erreur de chargement lazy route (chunk manquant → rechargement)
    if (this.isChunkLoadError(error)) {
      console.warn('[ChunkLoadError] Module manquant — rechargement de la page.');
      window.location.reload();
      return;
    }

    // Toute autre erreur JS inattendue
    console.error('[GlobalError]', error);

    // Rediriger vers /unauthorized sur une NavigationError (route guard rejet)
    if (this.isNavigationError(error)) {
      this.zone.run(() => this.router.navigate(['/unauthorized']));
    }
  }

  private isChunkLoadError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return (
      error.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error.message) ||
      /failed to fetch dynamically imported module/i.test(error.message)
    );
  }

  private isNavigationError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.name === 'NavigationError';
  }
}
