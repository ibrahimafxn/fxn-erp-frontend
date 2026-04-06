import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RevenueService, RevenueSummaryPoint } from '../../../core/services/revenue.service';
import { AbsenceService } from '../../../core/services/absence.service';
import { Absence, AbsenceStatus } from '../../../core/models';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dirigeant-dashboard',
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './dirigeant-dashboard.html',
  styleUrl: './dirigeant-dashboard.scss',
})
export class DirigeantDashboard {
  private revenueService = inject(RevenueService);
  private absenceService = inject(AbsenceService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly caThisMonth = signal(0);
  readonly caYtd = signal(0);
  readonly penaltyYtd = signal(0);
  readonly pendingAbsences = signal<Absence[]>([]);
  readonly revenueMonths = signal<RevenueSummaryPoint[]>([]);

  readonly maxMonthAmount = signal(1);

  private readonly currentYear = new Date().getFullYear();
  private readonly currentMonth = new Date().getMonth() + 1;

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      revenue: this.revenueService.summary({ year: this.currentYear }),
      absences: this.absenceService.list({ status: 'EN_ATTENTE' }),
    }).subscribe({
      next: ({ revenue, absences }) => {
        if (revenue?.success) {
          const series = revenue.data.series || [];

          const thisMonthPoint = series.find(
            (p) => p.year === this.currentYear && p.month === this.currentMonth,
          );
          this.caThisMonth.set(thisMonthPoint?.amountHt ?? 0);
          this.caYtd.set(revenue.data.total ?? series.reduce((sum, p) => sum + (p.amountHt || 0), 0));
          this.penaltyYtd.set(series.reduce((sum, p) => sum + (p.penalty || 0), 0));

          // Keep last 6 months
          const last6 = [...series]
            .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))
            .slice(-6);
          this.revenueMonths.set(last6);
          const maxAmt = Math.max(...last6.map((p) => p.amountHt || 0), 1);
          this.maxMonthAmount.set(maxAmt);
        }

        if (absences?.success) {
          this.pendingAbsences.set(absences.data || []);
        }

        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur lors du chargement du tableau de bord.');
      },
    });
  }

  private reloadAbsences(): void {
    this.absenceService.list({ status: 'EN_ATTENTE' }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.pendingAbsences.set(res.data || []);
        }
      },
      error: () => {},
    });
  }

  approveAbsence(id: string | undefined): void {
    if (!id) return;
    this.absenceService.updateStatus(id, 'APPROUVE' as AbsenceStatus).subscribe({
      next: () => this.reloadAbsences(),
      error: () => {},
    });
  }

  rejectAbsence(id: string | undefined): void {
    if (!id) return;
    this.absenceService.updateStatus(id, 'REFUSE' as AbsenceStatus).subscribe({
      next: () => this.reloadAbsences(),
      error: () => {},
    });
  }

  formatAmount(n: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(n || 0);
  }

  formatMonth(year: number, month: number): string {
    const MONTHS_SHORT = [
      'Janv.',
      'Févr.',
      'Mars',
      'Avr.',
      'Mai',
      'Juin',
      'Juil.',
      'Août',
      'Sept.',
      'Oct.',
      'Nov.',
      'Déc.',
    ];
    const label = MONTHS_SHORT[(month ?? 1) - 1] ?? String(month);
    return `${label} ${year}`;
  }

  barWidthPercent(amountHt: number): string {
    const max = this.maxMonthAmount();
    if (!max) return '0%';
    const pct = Math.round((Math.max(0, amountHt) / max) * 100);
    return `${pct}%`;
  }

  absenceTypeLabel(type: string): string {
    const map: Record<string, string> = {
      CONGE: 'Congé',
      MALADIE: 'Maladie',
      PERMISSION: 'Permission',
      FORMATION: 'Formation',
      AUTRE: 'Autre',
    };
    return map[type] ?? type;
  }

  absenceName(absence: Absence): string {
    const t = absence.technician;
    if (!t) return '—';
    const first = t.firstName ?? '';
    const last = t.lastName ?? '';
    return `${first} ${last}`.trim() || t.email || '—';
  }

  absenceDays(absence: Absence): number {
    if (!absence.startDate || !absence.endDate) return 0;
    const start = new Date(absence.startDate);
    const end = new Date(absence.endDate);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return absence.isHalfDay ? 0.5 : Math.max(diff, 1);
  }

  isCurrentMonth(point: RevenueSummaryPoint): boolean {
    return point.year === this.currentYear && point.month === this.currentMonth;
  }

  scrollToAbsences(): void {
    const el = document.getElementById('absences-section');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
