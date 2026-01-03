import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  InterventionService,
  InterventionSummaryItem,
  InterventionFilters,
  InterventionTotals
} from '../../../core/services/intervention.service';

@Component({
  standalone: true,
  selector: 'app-interventions-dashboard',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './interventions-dashboard.html',
  styleUrls: ['./interventions-dashboard.scss']
})
export class InterventionsDashboard {
  private svc = inject(InterventionService);
  private fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly importLoading = signal(false);
  readonly importResult = signal<string | null>(null);
  readonly importError = signal<string | null>(null);

  readonly summaryItems = signal<InterventionSummaryItem[]>([]);
  readonly totals = signal<InterventionTotals | null>(null);

  readonly filters = signal<InterventionFilters>({
    regions: [],
    clients: [],
    statuses: [],
    technicians: [],
    types: []
  });

  readonly filterForm = this.fb.nonNullable.group({
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control(''),
    technician: this.fb.nonNullable.control(''),
    region: this.fb.nonNullable.control(''),
    client: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control('CLOTURE TERMINEE'),
    type: this.fb.nonNullable.control('')
  });

  readonly hasData = computed(() => this.summaryItems().length > 0);

  private selectedFile: File | null = null;

  constructor() {
    this.loadFilters();
    this.refresh();
  }

  onFileChange(event: Event): void {
    const el = event.target instanceof HTMLInputElement ? event.target : null;
    if (!el?.files?.length) {
      this.selectedFile = null;
      return;
    }
    this.selectedFile = el.files[0];
  }

  importCsv(): void {
    if (!this.selectedFile) {
      this.importError.set('Sélectionne un fichier CSV.');
      return;
    }

    this.importLoading.set(true);
    this.importError.set(null);
    this.importResult.set(null);

    this.svc.importCsv(this.selectedFile).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        if (res.success) {
          this.importResult.set('Import terminé.');
          this.selectedFile = null;
          this.loadFilters();
          this.refresh();
          return;
        }
        this.importError.set(res.message || 'Erreur import CSV');
      },
      error: (err: HttpErrorResponse) => {
        this.importLoading.set(false);
        this.importError.set(this.apiError(err, 'Erreur import CSV'));
      }
    });
  }

  refresh(): void {
    const f = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.svc.summary({
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      technician: f.technician || undefined,
      region: f.region || undefined,
      client: f.client || undefined,
      status: f.status || undefined,
      type: f.type || undefined
    }).subscribe({
      next: (res) => {
        this.summaryItems.set(res.data.items || []);
        this.totals.set(res.data.totals || null);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.apiError(err, 'Erreur chargement indicateurs'));
      }
    });
  }

  clearFilters(): void {
    this.filterForm.reset({
      fromDate: '',
      toDate: '',
      technician: '',
      region: '',
      client: '',
      status: 'CLOTURE TERMINEE',
      type: ''
    });
    this.refresh();
  }

  racTotal(item: InterventionSummaryItem | InterventionTotals | null): number {
    if (!item) return 0;
    return (item.racPavillon || 0)
      + (item.racImmeuble || 0)
      + (item.racF8 || 0)
      + (item.racProS || 0)
      + (item.racAutre || 0);
  }

  private loadFilters(): void {
    this.svc.filters().subscribe({
      next: (res) => {
        this.filters.set(res.data);
      },
      error: () => {}
    });
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
