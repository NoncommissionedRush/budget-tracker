import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'currencyEur', standalone: true })
export class CurrencyEurPipe implements PipeTransform {
  private readonly formatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });

  transform(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return this.formatter.format(num);
  }
}
