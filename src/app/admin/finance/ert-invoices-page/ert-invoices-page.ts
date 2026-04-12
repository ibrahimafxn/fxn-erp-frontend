import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { InterventionInvoiceSummary, InterventionService } from '../../../core/services/intervention.service';

@Component({
  standalone: true,
  selector: 'app-ert-invoices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './ert-invoices-page.html',
  styleUrls: ['./ert-invoices-page.scss']
})
export class ErtInvoicesPage {
  private svc = inject(InterventionService);

  @ViewChild('invoiceInput') private invoiceInput?: ElementRef<HTMLInputElement>;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly importLoading = signal(false);
  readonly importResult = signal<string | null>(null);
  readonly importError = signal<string | null>(null);
  readonly invoiceSummary = signal<InterventionInvoiceSummary | null>(null);
  readonly lastImportedInvoices = signal<InterventionInvoiceSummary['invoices']>([]);
  readonly selectedPeriodKey = signal('');

  selectedInvoices: File[] = [];

  readonly periodOptions = computed(() => {
    const invoices = this.invoiceSummary()?.invoices || [];
    const map = new Map<string, string>();
    for (const invoice of invoices) {
      if (!invoice.periodKey) continue;
      if (!map.has(invoice.periodKey)) {
        map.set(invoice.periodKey, invoice.periodLabel || invoice.periodKey);
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  });

  readonly displayedInvoices = computed(() => {
    const last = this.lastImportedInvoices();
    if (last.length) return last;
    const invoices = this.invoiceSummary()?.invoices || [];
    const period = this.selectedPeriodKey();
    return period ? invoices.filter((inv) => inv.periodKey === period) : invoices;
  });

  readonly invoiceTotalHt = computed(() =>
    this.displayedInvoices().reduce((acc, inv) => acc + Number(inv.totalHt || 0), 0)
  );

  constructor() {
    this.loadInvoices();
  }

  onInvoiceClick(): void {
    this.resetInvoiceInput();
  }

  onInvoiceChange(event: Event): void {
    const el = event.target instanceof HTMLInputElement ? event.target : null;
    this.selectedInvoices = el?.files ? Array.from(el.files) : [];
    this.importError.set(null);
    this.importResult.set(null);
  }

  onPeriodChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    this.selectedPeriodKey.set(el.value);
    this.lastImportedInvoices.set([]);
  }

  importInvoices(): void {
    if (!this.selectedInvoices.length) {
      this.importError.set('Sélectionne au moins un PDF.');
      return;
    }
    this.importLoading.set(true);
    this.importError.set(null);
    this.importResult.set(null);
    this.svc.importInvoices(this.selectedInvoices).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        if (!res.success) {
          this.importError.set(res.message || 'Erreur import factures');
          this.resetInvoiceInput();
          return;
        }
        const data = res.data as {
          imported?: number;
          skipped?: number;
          updated?: number;
          invoices?: InterventionInvoiceSummary['invoices'];
        } | undefined;
        const imported = data?.imported ?? 0;
        const skipped = data?.skipped ?? 0;
        const updated = data?.updated ?? 0;
        this.importResult.set(`Factures importées : ${imported}. Mises à jour : ${updated}. Ignorées : ${skipped}.`);
        const importedInvoices = data?.invoices || [];
        this.lastImportedInvoices.set(importedInvoices);
        if (importedInvoices.length) {
          const firstPeriod = importedInvoices.find((inv) => inv.periodKey)?.periodKey || '';
          if (firstPeriod) this.selectedPeriodKey.set(firstPeriod);
        }
        this.resetInvoiceInput();
        this.loadInvoices();
      },
      error: (err: HttpErrorResponse) => {
        this.importLoading.set(false);
        this.importError.set(this.apiError(err, 'Erreur import factures'));
        this.resetInvoiceInput();
      }
    });
  }

  private loadInvoices(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.invoiceSummary().subscribe({
      next: (res) => {
        this.invoiceSummary.set(res.data);
        const options = this.periodOptions();
        const current = this.selectedPeriodKey();
        const stillValid = options.some((opt) => opt.key === current);
        if ((!current || !stillValid) && options.length) {
          this.selectedPeriodKey.set(options[0].key);
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement factures'));
      }
    });
  }

  private resetInvoiceInput(): void {
    this.selectedInvoices = [];
    const input = this.invoiceInput?.nativeElement;
    if (input) input.value = '';
  }

  private apiError(err: unknown, fallback: string): string {
    const http = err as HttpErrorResponse | null;
    return http?.error?.message || http?.message || fallback;
  }
}
