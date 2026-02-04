import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  InterventionImportBatch,
  InterventionImportTechnicianSummary,
  InterventionService
} from '../../../core/services/intervention.service';
import { INTERVENTION_PRESTATION_FIELDS } from '../../../core/constant/intervention-prestations';

@Component({
  selector: 'app-technician-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './technician-dashboard.html',
  styleUrl: './technician-dashboard.scss'
})
export class TechnicianDashboard {
  private router = inject(Router);
  private interventions = inject(InterventionService);

  readonly caLoading = signal(false);
  readonly caError = signal<string | null>(null);
  readonly dailyAmount = signal(0);
  readonly weeklyAmount = signal(0);
  readonly monthlyAmount = signal(0);
  readonly todayLabel = computed(() => new Date().toLocaleDateString('fr-FR'));

  readonly importLoading = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importBatch = signal<InterventionImportBatch | null>(null);
  readonly importSummary = signal<InterventionImportTechnicianSummary | null>(null);

  readonly importLabel = computed(() => {
    const summaryDate = this.importSummary()?.referenceDate;
    const batch = this.importBatch();
    const date = summaryDate || batch?.importedAt || batch?.createdAt;
    if (!date) return 'Aucun import du jour';
    const formatted = new Date(date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    return `Dernier import : ${formatted}`;
  });

  readonly techRaccordements = computed(() => {
    const totals = this.importSummary()?.totals;
    if (!totals) return 0;
    return (
      Number(totals.racPavillon || 0) +
      Number(totals.racImmeuble || 0) +
      Number(totals.racProS || 0) +
      Number(totals.racProC || 0)
    );
  });
  readonly prestationCards = computed(() => {
    const totals = this.importSummary()?.totals;
    if (!totals) return [];
    const excludedKeys = new Set(['cablePav1', 'cablePav2', 'cablePav3', 'cablePav4']);
    return INTERVENTION_PRESTATION_FIELDS.map((field) => ({
      label: field.label,
      value: Number(totals[field.key] || 0),
      key: field.key
    }))
      .filter((item) => !excludedKeys.has(item.key))
      .filter((item) => item.value > 0);
  });

  constructor() {
    this.loadCa();
    this.loadImport();
  }

  goStock(): void {
    this.router.navigate(['/technician/resources/materials']).then();
  }

  goConsumables(): void {
    this.router.navigate(['/technician/resources/consumables']).then();
  }

  goVehicles(): void {
    this.router.navigate(['/technician/resources/vehicles']).then();
  }

  goReports(): void {
    this.router.navigate(['/technician/reports']).then();
  }

  goHistory(): void {
    this.router.navigate(['/technician/history']).then();
  }

  goInterventionsHistory(): void {
    this.router.navigate(['/technician/interventions']).then();
  }

  private loadCa(): void {
    this.caLoading.set(true);
    this.caError.set(null);
    const day = this.startOfToday();
    const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);
    const weekStart = this.startOfWeek(day);
    const todayStr = this.formatDateInput(day);
    const weekStartStr = this.formatDateInput(weekStart);
    const monthStartStr = this.formatDateInput(monthStart);

    forkJoin({
      daily: this.interventions.importSummaryTechnician({ fromDate: todayStr, toDate: todayStr }),
      weekly: this.interventions.importSummaryTechnician({ fromDate: weekStartStr, toDate: todayStr }),
      monthly: this.interventions.importSummaryTechnician({ fromDate: monthStartStr, toDate: todayStr })
    }).subscribe({
      next: (res) => {
        this.dailyAmount.set(res.daily.data.totalAmount || 0);
        this.weeklyAmount.set(res.weekly.data.totalAmount || 0);
        this.monthlyAmount.set(res.monthly.data.totalAmount || 0);
        this.caLoading.set(false);
      },
      error: (err) => {
        this.caLoading.set(false);
        this.caError.set(err?.message || 'Erreur chargement CA');
      }
    });
  }

  private loadImport(): void {
    this.importLoading.set(true);
    this.importError.set(null);
    this.interventions.listImportsTechnician({ limit: 10 }).subscribe({
      next: (res) => {
        const items = res.data.items || [];
        const batch = items.find((item) => item.isToday) || items[0] || null;
        this.importBatch.set(batch);
        const today = this.startOfToday();
        const todayStr = this.formatDateInput(today);
        const summary$ = this.interventions.importSummaryTechnician({
          ...(batch?._id ? { importBatchId: batch._id } : {}),
          fromDate: todayStr,
          toDate: todayStr
        });
        if (!batch?._id) {
          summary$.subscribe({
            next: (summaryRes) => {
              this.importSummary.set(summaryRes.data);
              this.importLoading.set(false);
            },
            error: (err) => {
              this.importSummary.set(null);
              this.importLoading.set(false);
              this.importError.set(err?.message || 'Erreur chargement import');
            }
          });
          return;
        }
        summary$.subscribe({
          next: (importRes) => {
            this.importSummary.set(importRes.data);
            this.importLoading.set(false);
          },
          error: (err) => {
            this.importSummary.set(null);
            this.importLoading.set(false);
            this.importError.set(err?.message || 'Erreur chargement import');
          }
        });
      },
      error: (err) => {
        this.importLoading.set(false);
        this.importError.set(err?.message || 'Erreur chargement import');
      }
    });
  }

  formatAmount(value?: number | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private startOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const start = new Date(date);
    start.setDate(date.getDate() + diff);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  private formatDateInput(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth}`;
  }

}
