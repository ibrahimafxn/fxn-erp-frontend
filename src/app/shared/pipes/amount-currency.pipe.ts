import { Pipe, PipeTransform } from '@angular/core';

export function formatAmountCurrency(value?: number | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

@Pipe({
  name: 'amountCurrency',
  standalone: true
})
export class AmountCurrencyPipe implements PipeTransform {
  transform(value?: number | null): string {
    return formatAmountCurrency(value);
  }
}
