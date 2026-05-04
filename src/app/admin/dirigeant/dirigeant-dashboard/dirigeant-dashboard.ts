import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RevenueService, RevenueSummaryPoint } from '../../../core/services/revenue.service';
import { AbsenceService } from '../../../core/services/absence.service';
import { Absence, AbsenceStatus } from '../../../core/models';
import {
  InterventionPerformanceKpi,
  InterventionTotals,
  InterventionService
} from '../../../core/services/intervention.service';
import {
  InterventionRates,
  InterventionRatesService
} from '../../../core/services/intervention-rates.service';

type KpiPeriod = { year: number; month: number };

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
  private interventionService = inject(InterventionService);
  private interventionRatesService = inject(InterventionRatesService);

  readonly loading = signal(true);
  readonly kpiLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly caThisMonth = signal(0);
  readonly caYtd = signal(0);
  readonly penaltyYtd = signal(0);
  readonly pendingAbsences = signal<Absence[]>([]);
  readonly revenueMonths = signal<RevenueSummaryPoint[]>([]);
  readonly performanceItems = signal<InterventionPerformanceKpi[]>([]);
  readonly performancePeriodLabel = signal('');
  readonly performanceItemCount = signal(0);
  readonly performanceCancelledCount = signal(0);
  readonly performanceTotalMerged = signal(0);
  readonly performanceFromDbCount = signal(0);
  readonly performanceMalusPotential = signal(0);
  readonly performanceBonusPotential = signal(0);
  readonly performanceNetPotential = signal(0);
  readonly performanceAppliedMalus = signal(0);
  readonly performanceAppliedBonus = signal(0);
  readonly performanceNetApplied = signal(0);
  readonly performanceMaxMalus = signal(0);
  readonly performanceMaxBonus = signal(0);

  readonly maxMonthAmount = signal(1);

  private readonly currentYear = new Date().getFullYear();
  private readonly currentMonth = new Date().getMonth() + 1;

  // KPI period selector — starts at current month
  readonly kpiPeriod = signal<KpiPeriod>({ year: this.currentYear, month: this.currentMonth });

  readonly kpiPeriodLabel = computed(() => {
    const { year, month } = this.kpiPeriod();
    return this.formatMonth(year, month);
  });

  readonly kpiFromDate = computed(() => {
    const { year, month } = this.kpiPeriod();
    return `${year}-${String(month).padStart(2, '0')}-01`;
  });

  readonly kpiToDate = computed(() => {
    const { year, month } = this.kpiPeriod();
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      revenue: this.revenueService.summary({ year: this.currentYear }),
      absences: this.absenceService.list({ status: 'EN_ATTENTE' }),
      interventionsMonth: this.interventionService.importSummaryTechnician({
        fromDate: this.firstDayOfCurrentMonth(),
        toDate: this.lastDayOfCurrentMonth(),
      }),
      performance: this.interventionService.performanceKpis({
        fromDate: this.kpiFromDate(),
        toDate: this.kpiToDate(),
      }),
      rates: this.interventionRatesService.refresh(),
    }).subscribe({
      next: ({ revenue, absences, interventionsMonth, performance, rates }) => {
        if (revenue?.success) {
          const series = revenue.data.series || [];

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

        if (interventionsMonth?.success) {
          const osirisAmount = this.osirisAmountFromTotals(interventionsMonth.data.totals, rates);
          const apiAmount = Number(interventionsMonth.data.totalAmount ?? 0);
          this.caThisMonth.set(osirisAmount !== 0 ? osirisAmount : apiAmount);
        } else {
          this.caThisMonth.set(0);
        }

        if (absences?.success) {
          this.pendingAbsences.set(absences.data || []);
        }

        this.applyPerformanceData(performance);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur lors du chargement du tableau de bord.');
      },
    });
  }

  private loadKpiData(): void {
    this.kpiLoading.set(true);
    this.interventionService.performanceKpis({
      fromDate: this.kpiFromDate(),
      toDate: this.kpiToDate(),
    }).subscribe({
      next: (performance) => {
        this.applyPerformanceData(performance);
        this.kpiLoading.set(false);
      },
      error: () => {
        this.kpiLoading.set(false);
      },
    });
  }

  private applyPerformanceData(performance: { success: boolean; data: any } | null): void {
    if (performance?.success) {
      this.performanceItems.set(performance.data.items || []);
      this.performancePeriodLabel.set(performance.data.period?.label || '');
      this.performanceItemCount.set(performance.data.totals?.itemCount ?? 0);
      this.performanceCancelledCount.set(performance.data.totals?.cancelledCount ?? 0);
      this.performanceTotalMerged.set(performance.data.totals?.totalMerged ?? 0);
      this.performanceFromDbCount.set(performance.data.totals?.fromDbCount ?? 0);
      this.performanceMalusPotential.set(performance.data.totals?.malusPotential ?? 0);
      this.performanceBonusPotential.set(performance.data.totals?.bonusPotential ?? 0);
      this.performanceNetPotential.set(performance.data.totals?.netPotential ?? 0);
      this.performanceAppliedMalus.set(performance.data.totals?.appliedMalus ?? 0);
      this.performanceAppliedBonus.set(performance.data.totals?.appliedBonus ?? 0);
      this.performanceNetApplied.set(performance.data.totals?.netApplied ?? 0);
      this.performanceMaxMalus.set(performance.data.totals?.maxMalusPotential ?? 0);
      this.performanceMaxBonus.set(performance.data.totals?.maxBonusPotential ?? 0);
    } else {
      this.performanceItems.set([]);
      this.performancePeriodLabel.set('');
      this.performanceItemCount.set(0);
      this.performanceCancelledCount.set(0);
      this.performanceTotalMerged.set(0);
      this.performanceFromDbCount.set(0);
      this.performanceMalusPotential.set(0);
      this.performanceBonusPotential.set(0);
      this.performanceNetPotential.set(0);
      this.performanceAppliedMalus.set(0);
      this.performanceAppliedBonus.set(0);
      this.performanceNetApplied.set(0);
      this.performanceMaxMalus.set(0);
      this.performanceMaxBonus.set(0);
    }
  }

  kpiPrevMonth(): void {
    const { year, month } = this.kpiPeriod();
    if (month === 1) {
      this.kpiPeriod.set({ year: year - 1, month: 12 });
    } else {
      this.kpiPeriod.set({ year, month: month - 1 });
    }
    this.loadKpiData();
  }

  kpiNextMonth(): void {
    const { year, month } = this.kpiPeriod();
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) {
      this.kpiPeriod.set({ year: year + 1, month: 1 });
    } else {
      this.kpiPeriod.set({ year, month: month + 1 });
    }
    this.loadKpiData();
  }

  kpiIsCurrentMonth(): boolean {
    const { year, month } = this.kpiPeriod();
    return year === this.currentYear && month === this.currentMonth;
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
      error: (err) => {
        this.error.set(err?.error?.message || 'Erreur lors de l\'approbation.');
      },
    });
  }

  rejectAbsence(id: string | undefined): void {
    if (!id) return;
    this.absenceService.updateStatus(id, 'REFUSE' as AbsenceStatus).subscribe({
      next: () => this.reloadAbsences(),
      error: (err) => {
        this.error.set(err?.error?.message || 'Erreur lors du rejet.');
      },
    });
  }

  formatAmount(n: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(n || 0);
  }

  private osirisAmountFromTotals(totals: InterventionTotals | null | undefined, rates: InterventionRates): number {
    if (!totals) return 0;
    const qty = (value?: number | null) => Number(value ?? 0);
    const rate = (entry?: { total: number } | null) => Number(entry?.total ?? 0);
    return (
      qty(totals.racPavillon) * rate(rates.racPavillon) +
      qty(totals.racSouterrain) * rate(rates.racSouterrain) +
      qty(totals.racAerien) * rate(rates.racAerien) +
      qty(totals.racFacade) * rate(rates.racFacade) +
      qty(totals.clem) * rate(rates.clem) +
      qty(totals.reconnexion) * rate(rates.reconnexion) +
      qty(totals.racImmeuble) * rate(rates.racImmeuble) +
      qty(totals.racProS) * rate(rates.racProS) +
      qty(totals.racProC) * rate(rates.racProC) +
      qty(totals.racF8) * rate(rates.racF8) +
      qty(totals.fourreauBeton) * rate(rates.fourreauBeton) +
      qty(totals.prestaCompl) * rate(rates.prestaCompl) +
      qty(totals.deplacementPrise ?? totals.deprise) * rate(rates.deplacementPrise) +
      qty(totals.deplacementOffert) * rate(rates.deplacementOffert) +
      qty(totals.deplacementATort) * rate(rates.deplacementATort) +
      qty(totals.demo) * rate(rates.demo) +
      qty(totals.sav) * rate(rates.sav) +
      qty(totals.savExp) * rate(rates.savExp) +
      qty(totals.swapEquipement) * rate(rates.swapEquipement) +
      qty(totals.refrac) * rate(rates.refrac) +
      qty(totals.refcDgr) * rate(rates.refcDgr) +
      qty(totals.cableSl) * rate(rates.cableSl) +
      qty(totals.bifibre) * rate(rates.bifibre) +
      qty(totals.nacelle) * rate(rates.nacelle)
    );
  }

  formatMetric(value: number | null | undefined, precision = 1): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: precision,
    }).format(value);
  }

  formatPercent(value: number | null | undefined, precision = 1): string {
    const metric = this.formatMetric(value, precision);
    return metric === '—' ? metric : `${metric} %`;
  }

  formatSignedPercent(value: number | null | undefined, precision = 1): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${this.formatMetric(Math.abs(value), precision)} %`;
  }

  formatPerformanceRate(kpi: InterventionPerformanceKpi): string {
    if (kpi.rate === null || kpi.rate === undefined) return '—';
    return this.formatPercent(kpi.rate, kpi.ratePrecision ?? 1);
  }

  formatPerformanceObjective(kpi: InterventionPerformanceKpi): string {
    return `${kpi.objectiveOperator} ${this.formatPercent(kpi.objectiveValue, kpi.objectivePrecision ?? 1)}`;
  }

  performanceStatusLabel(kpi: InterventionPerformanceKpi): string {
    switch (kpi.status) {
      case 'good':
        return "Dans l'objectif";
      case 'warning':
        return 'Sous surveillance';
      case 'danger':
        return 'Hors objectif';
      default:
        return 'Sans base';
    }
  }

  performanceIcon(kpi: InterventionPerformanceKpi): string {
    switch (kpi.status) {
      case 'good':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'danger':
        return 'error_outline';
      default:
        return 'help_outline';
    }
  }

  getKpiTooltip(code: number): string {
    const rules: Record<number, string> = {
      33: [
        'KPI 33 — Taux RACC Conquête + Déménagement',
        '',
        'Objectif : mesurer la rapidité de mise en service des nouvelles commandes',
        '',
        'Périmètre : RACC Conquête ou Déménagement (colonne parcours du CSV Osiris)',
        'Succès : intervention clôturée avec succès le jour J (statut CLOTURE TERMINEE)',
        '⚠ La date de prise de commande est absente du CSV Osiris.',
        '   On considère comme succès toute intervention clôturée lors du passage technicien.',
        '',
        'Objectif : > 73 % | Malus −3 % (pente 2,5) | Bonus +2 % (pente 2,5)',
      ].join('\n'),
      34: [
        'KPI 34 — Taux RACC Migration',
        '',
        'Objectif : mesurer la rapidité de mise en service pour les migrations',
        '',
        'Périmètre : RACC Migration (colonne parcours du CSV Osiris)',
        'Succès : intervention clôturée avec succès le jour J (statut CLOTURE TERMINEE)',
        '⚠ La date de prise de commande est absente du CSV Osiris.',
        '   On considère comme succès toute intervention clôturée lors du passage technicien.',
        '',
        'Objectif : > 60 % | Malus −3 % (pente 2,5) | Bonus +2 % (pente 2,5)',
      ].join('\n'),
      35: [
        'KPI 35 — Taux RECO (Prise existante = OUI)',
        '',
        'Objectif : mesurer la rapidité de reconnexion pour les commandes avec prise existante',
        '',
        'Périmètre : RACC tous parcours confondus avec colonne prise_existante = OUI',
        'Succès : intervention clôturée avec succès le jour J (statut CLOTURE TERMINEE)',
        '',
        'Objectif : > 84 % | Malus −3 % (pente 2,5) | Bonus +2 % (pente 2,5)',
      ].join('\n'),
      36: [
        'KPI 36 — Taux R/P Échec (1er et 2ème RDV)',
        '',
        'Objectif : évaluer la qualité d\'intervention sur les deux premiers passages',
        '',
        'Périmètre : RACC au 1er ou 2ème RDV (colonne nb_rdv = 1 ou 2)',
        'Succès : intervention clôturée avec succès le jour J du rendez-vous',
        'Échec : RDV non clôturé en succès le jour même est comptabilisé en échec',
        '',
        'Objectif : > 74 % | Malus −2 % (pente 3,3) | Bonus +2 % (pente 3,3)',
      ].join('\n'),
      37: [
        'KPI 37 — Clients non rétablis à J (RACC)',
        '',
        'Objectif : mesurer si la hotline a clôturé à J une intervention',
        '   durant laquelle un client voisin est tombé au PM.',
        '',
        'Dénominateur : tous les RACC clôturés (statut terminal)',
        'Numérateur : RACC avec check_voisinage = IMPACT',
        '   ET non clôturés en succès le jour J de l\'intervention',
        '   (si clôturé le jour J malgré l\'impact → non compté en échec)',
        '',
        'Objectif : < 0,035 % | Malus −2 % (pente 0,05) | Bonus +1 % (pente 0,05)',
      ].join('\n'),
    };
    return rules[code] ?? `KPI ${code} — ${this.performanceItems().find((k) => k.code === code)?.basis ?? ''}`;
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

  private firstDayOfCurrentMonth(): string {
    return `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-01`;
  }

  private lastDayOfCurrentMonth(): string {
    const lastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    return `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
}
