import { inject, Pipe, PipeTransform } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Formate un nombre selon la préférence `decimalSeparator` de l'utilisateur.
 *
 *  - 'comma' (défaut FR) → 1 234,50
 *  - 'dot'   (EN)        → 1,234.50
 *
 * Usage :  {{ amount | userNumber }}
 *          {{ amount | userNumber:2 }}           → 2 décimales
 *          {{ amount | userNumber:2:true }}       → avec symbole €
 */
@Pipe({
  name: 'userNumber',
  standalone: true,
  pure: false   // réagit au changement de préférence en cours de session
})
export class UserNumberPipe implements PipeTransform {
  private auth = inject(AuthService);

  transform(
    value: number | string | null | undefined,
    decimals = 2,
    currency = false
  ): string {
    if (value === null || value === undefined || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);

    const sep = this.auth.user$()?.preferences?.decimalSeparator ?? 'comma';
    const locale = sep === 'dot' ? 'en-US' : 'fr-FR';

    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);

    return currency ? `${formatted} €` : formatted;
  }
}
