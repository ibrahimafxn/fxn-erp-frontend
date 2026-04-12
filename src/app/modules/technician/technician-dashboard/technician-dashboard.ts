import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import {
  InterventionImportBatch,
  InterventionImportTechnicianSummary,
  InterventionService
} from '../../../core/services/intervention.service';
import { INTERVENTION_PRESTATION_FIELDS } from '../../../core/constant/intervention-prestations';
import { TechnicianReportService } from '../../../core/services/technician-report.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatDateInput, formatFrDate, formatFrDateTime, startOfToday } from '../../../core/utils/date-format';
import { parseFiniteNumber } from '../../../core/utils/number';
import { AmountCurrencyPipe } from '../../../shared/pipes/amount-currency.pipe';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';

@Component({
  selector: 'app-technician-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule, TechnicianMobileNav, AmountCurrencyPipe],
  templateUrl: './technician-dashboard.html',
  styleUrl: './technician-dashboard.scss'
})
export class TechnicianDashboard {
  private router = inject(Router);
  private interventions = inject(InterventionService);
  private reports = inject(TechnicianReportService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  readonly caLoading = signal(false);
  readonly caError = signal<string | null>(null);
  readonly dailyAmount = signal(0);
  readonly weeklyAmount = signal(0);
  readonly monthlyAmount = signal(0);
  readonly todayLabel = computed(() => formatFrDate(new Date()));

  readonly importLoading = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importBatch = signal<InterventionImportBatch | null>(null);
  readonly importSummary = signal<InterventionImportTechnicianSummary | null>(null);

  readonly importLabel = computed(() => {
    const summaryDate = this.importSummary()?.referenceDate;
    const batch = this.importBatch();
    const date = summaryDate || batch?.importedAt || batch?.createdAt;
    if (!date) return 'Aucun import du jour';
    const formatted = formatFrDateTime(date);
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

  goCharges(): void {
    this.router.navigate(['/technician/charges']).then();
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
    const userId = this.currentUserId();
    this.reports.summaryPeriods(userId || undefined).subscribe({
      next: (res) => {
        this.dailyAmount.set(parseFiniteNumber(res.daily.data.totalAmount));
        this.weeklyAmount.set(parseFiniteNumber(res.weekly.data.totalAmount));
        this.monthlyAmount.set(parseFiniteNumber(res.monthly.data.totalAmount));
        this.caLoading.set(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.caLoading.set(false);
        this.caError.set(err?.message || 'Erreur chargement CA');
        this.cdr.markForCheck();
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
        const today = startOfToday();
        const todayStr = formatDateInput(today);
        this.resolveImportSummary$(batch?._id || null, todayStr).subscribe({
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
      },
      error: (err) => {
        this.importLoading.set(false);
        this.importError.set(err?.message || 'Erreur chargement import');
      }
    });
  }

  private resolveImportSummary$(batchId: string | null, todayStr: string) {
    return batchId
      ? this.interventions.importSummaryTechnician({ importBatchId: batchId })
      : this.interventions.importSummaryTechnician({ fromDate: todayStr, toDate: todayStr });
  }

  private currentUserId(): string | null {
    const user = this.auth.getCurrentUser();
    if (!user?._id) return null;
    return String(user._id);
  }
}
