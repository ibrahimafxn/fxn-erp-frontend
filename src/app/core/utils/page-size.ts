import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Retourne la taille de page préférée de l'utilisateur connecté.
 * À appeler dans le contexte d'injection Angular (initialiseur de champ de composant).
 *
 * @example
 * readonly limit = signal(preferredPageSize());
 */
export function preferredPageSize(): number {
  return inject(AuthService).defaultPageSize();
}
