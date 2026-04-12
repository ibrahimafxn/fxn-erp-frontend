import { DatePipe } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Pipe({
  name: 'frDate',
  standalone: true,
  pure: false   // réagit au changement de préférence dateFormat en cours de session
})
export class FrDatePipe implements PipeTransform {
  private datePipe = inject(DatePipe);
  private auth = inject(AuthService);

  transform(value: string | Date | null, variant: 'short' | 'full' = 'short'): string {
    if (!value) return '';
    const fmt = this.auth.user$()?.preferences?.dateFormat ?? 'dmy';

    if (variant === 'full') {
      // Le format complet ne change pas selon la préférence (nom du jour + mois en toutes lettres)
      return (
        this.datePipe.transform(value, 'EEEE d MMMM yyyy', undefined, 'fr-FR')?.toLowerCase() ?? ''
      );
    }

    const dateFormat = fmt === 'mdy' ? 'MM/dd/yyyy' : 'dd/MM/yyyy';
    return this.datePipe.transform(value, dateFormat, undefined, 'fr-FR') ?? '';
  }
}
