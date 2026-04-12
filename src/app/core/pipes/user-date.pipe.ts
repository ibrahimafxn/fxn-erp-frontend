import { DatePipe } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Formate une date selon la préférence `dateFormat` de l'utilisateur connecté.
 *
 * Formats :
 *  - 'dmy'      → 25/06/2025  (défaut FR)
 *  - 'mdy'      → 06/25/2025  (US)
 *  - 'relative' → il y a 2 jours / dans 3 h  (relatif)
 *
 * Usage :  {{ value | userDate }}
 *          {{ value | userDate:'time' }}   → ajoute HH:mm
 */
@Pipe({
  name: 'userDate',
  standalone: true,
  pure: false   // doit réagir au changement de préférence en cours de session
})
export class UserDatePipe implements PipeTransform {
  private auth = inject(AuthService);
  private datePipe = inject(DatePipe);

  transform(value: string | Date | null | undefined, variant: 'date' | 'time' | 'datetime' = 'date'): string {
    if (!value) return '—';

    const fmt = this.auth.user$()?.preferences?.dateFormat ?? 'dmy';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);

    if (fmt === 'relative') {
      return this.toRelative(date, variant);
    }

    const dateFormat = fmt === 'mdy' ? 'MM/dd/yyyy' : 'dd/MM/yyyy';
    const timeFormat = 'HH:mm';

    const pattern =
      variant === 'datetime' ? `${dateFormat} ${timeFormat}` :
      variant === 'time'     ? `${dateFormat} ${timeFormat}` :
                               dateFormat;

    return this.datePipe.transform(date, pattern, undefined, 'fr-FR') ?? '—';
  }

  private toRelative(date: Date, variant: 'date' | 'time' | 'datetime'): string {
    const now = Date.now();
    const diff = now - date.getTime();   // ms, positive = passé
    const abs = Math.abs(diff);
    const future = diff < 0;
    const prefix = future ? 'dans ' : 'il y a ';
    const suffix = future ? '' : '';

    const minute = 60_000;
    const hour   = 3_600_000;
    const day    = 86_400_000;
    const week   = 7 * day;
    const month  = 30 * day;
    const year   = 365 * day;

    let label: string;
    if (abs < minute)        label = "à l'instant";
    else if (abs < hour)     label = `${prefix}${Math.round(abs / minute)} min${suffix}`;
    else if (abs < day)      label = `${prefix}${Math.round(abs / hour)} h${suffix}`;
    else if (abs < 2 * day)  label = future ? 'demain' : 'hier';
    else if (abs < week)     label = `${prefix}${Math.round(abs / day)} jours${suffix}`;
    else if (abs < month)    label = `${prefix}${Math.round(abs / week)} sem.${suffix}`;
    else if (abs < year)     label = `${prefix}${Math.round(abs / month)} mois${suffix}`;
    else                     label = `${prefix}${Math.round(abs / year)} an(s)${suffix}`;

    if (variant !== 'date' && abs < day) {
      // Ajoute l'heure si on est dans la même journée et variant inclut le temps
      const hm = this.datePipe.transform(date, 'HH:mm') ?? '';
      if (hm) label += ` (${hm})`;
    }

    return label;
  }
}
