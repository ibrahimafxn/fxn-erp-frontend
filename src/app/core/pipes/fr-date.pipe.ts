import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';

@Pipe({
  name: 'frDate',
  standalone: true,
})
export class FrDatePipe implements PipeTransform {
  private datePipe = inject(DatePipe);

  transform(
    value: string | Date | null,
    variant: 'short' | 'full' = 'short'
  ): string {
    if (!value) return '';

    const format =
      variant === 'full'
        ? 'EEEE d MMMM yyyy'
        : 'dd/MM/yyyy';

    return (
      this.datePipe
        .transform(value, format, undefined, 'fr-FR')
        ?.toLowerCase() ?? ''
    );
  }

}
