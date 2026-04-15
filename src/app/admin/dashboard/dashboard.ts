// dashboard.ts

import { Component, computed, inject, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {Router, RouterModule} from '@angular/router';
import { forkJoin } from 'rxjs';
import {AdminService} from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/roles.model';
import {HistoryItem} from '../../core/models/historyItem.model';
import { AbsenceService } from '../../core/services/absence.service';
import { InterventionService } from '../../core/services/intervention.service';
import { MovementService } from '../../core/services/movement.service';
import { Movement } from '../../core/models';

type DashboardAuditItem = {
  technician: string;
  region: string;
  nbTotal: number;
  txEchecGlobal: number;
  echecs: Array<{ motifEchec: string }>;
};

type DashboardAuditInsight = {
  riskiestTechnician: string | null;
  riskiestRate: number | null;
  riskiestFailures: number;
  riskiestScore: number;
  riskiestRegion: string | null;
  regionFailures: number;
};

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  imports: [CommonModule, RouterModule, DatePipe]
})
export class Dashboard implements OnInit {
  readonly adminService = inject(AdminService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private absenceService = inject(AbsenceService);
  private interventions = inject(InterventionService);
  private movementService = inject(MovementService);
  private readonly numberFormat = new Intl.NumberFormat('fr-FR');
  private readonly donutRadius = 90;
  private readonly donutCircumference = 2 * Math.PI * this.donutRadius;
  private readonly donutPalette = [
    '#6BA4FF', '#2BD4A8', '#8B5CF6', '#F59E0B', '#38BDF8',
    '#F97316', '#22C55E', '#E879F9', '#94A3B8', '#34D399',
    '#60A5FA', '#F43F5E'
  ];

  /** Palette étendue pour les types non listés — 24 couleurs bien réparties dans la roue chromatique */
  private readonly _fallbackPalette = [
    '#EF4444', '#FB923C', '#EAB308', '#84CC16', '#10B981',
    '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#A855F7',
    '#EC4899', '#F472B6', '#FCA5A5', '#FDBA74', '#FDE68A',
    '#BBF7D0', '#99F6E4', '#BAE6FD', '#BFDBFE', '#DDD6FE',
    '#FBCFE8', '#D1FAE5', '#FEF3C7', '#E0E7FF',
  ];

  /** Cache d'assignation séquentielle pour les types non listés */
  private readonly _dynamicColorCache = new Map<string, string>();
  private _dynamicColorIndex = 0;

  readonly prestationsTrend = signal<{
    key: string;
    label: string;
    tooltip: string;
    value: number;
    percent: number;
    primaryTypeLabel?: string;
    types?: { key: string; label: string; shortLabel: string; count: number; percent: number; color: string }[];
  }[]>([]);
  readonly prestationsTypes = signal<{ key: string; label: string; value: number; percent: number; color: string }[]>([]);
  readonly prestationsTypesWeek = signal<{ key: string; label: string; value: number; percent: number; color: string }[]>([]);
  readonly prestationsTypesRange = signal<{ from: string; to: string } | null>(null);
  readonly todayInterventionsCount = signal(0);
  readonly todayAbsentTechniciansCount = signal(0);
  readonly auditItems = signal<DashboardAuditItem[]>([]);
  readonly auditTotals = signal<{ nbTotal: number; nbEchecs: number; txEchecGlobal: number } | null>(null);
  readonly auditTopMotif = signal<string | null>(null);
  readonly materialInsight = signal({
    topTechnician: null as string | null,
    topTechnicianQty: 0,
    ptoQty: 0,
    jarretiereQty: 0
  });

  // On réexpose les signals du service pour les templates
  readonly stats = this.adminService.stats;       // Signal<DashboardStats | null>
  readonly loading = this.adminService.loading;   // Signal<boolean>
  readonly error = this.adminService.error;       // Signal<any | null>
  readonly historySignal = this.adminService.history; // Signal<HistoryItem[]>
  readonly pendingAbsenceCount = this.absenceService.pendingCount;

  // Derniers mouvements (ex : 10 derniers)
  readonly recentHistory = computed(() => {
    const list = this.historySignal() || [];
    return list.slice(0, 10);
  });

  readonly prestationsSeries = computed(() => {
    const stats = this.stats();
    const week = Number(stats?.prestationsWeek ?? 0);
    const month = Number(stats?.prestationsMonth ?? 0);
    const max = Math.max(week, month, 1);
    return [
      {
        key: 'week',
        label: 'Semaine',
        value: week,
        percent: Math.round((week / max) * 100)
      },
      {
        key: 'month',
        label: 'Mois',
        value: month,
        percent: Math.round((month / max) * 100)
      }
    ];
  });

  readonly prestationsDelta = computed(() => {
    const stats = this.stats();
    const week = Number(stats?.prestationsWeek ?? 0);
    const month = Number(stats?.prestationsMonth ?? 0);
    if (!month) return null;
    return Math.round((week / month) * 100);
  });

  readonly prestationsTrendTotal = computed(() =>
    this.prestationsTrend().reduce((sum, item) => sum + item.value, 0)
  );

  readonly prestationsTypesTotal = computed(() =>
    this.prestationsTypes().reduce((sum, item) => sum + item.value, 0)
  );

  /** Total semaine calculé depuis le détail par type (même source que les barres) */
  readonly prestationsTypesWeekTotal = computed(() =>
    this.prestationsTypesWeek().reduce((sum, item) => sum + item.value, 0)
  );
  readonly prestationsTypesMini = computed(() => {
    const items = this.prestationsTypesWeek();
    if (!items.length) return [];
    const colorByKey = new Map(
      this.prestationsTypes().map(item => [this.normalizeKey(item.key), item.color])
    );
    const preferredKeys = ['racpros', 'racf8'];
    const picks: typeof items = [];
    const used = new Set<string>();
    for (const pref of preferredKeys) {
      const match = items.find(item => this.normalizeKey(item.key) === pref);
      if (match) {
        const color = colorByKey.get(this.normalizeKey(match.key));
        picks.push(color ? { ...match, color } : match);
        used.add(this.normalizeKey(match.key));
      }
    }
    for (const item of items) {
      const key = this.normalizeKey(item.key);
      if (used.has(key)) continue;
      const color = colorByKey.get(key);
      picks.push(color ? { ...item, color } : item);
      used.add(key);
      if (picks.length >= 6) break;
    }
    return picks.slice(0, 6);
  });
  readonly prestationsTrendTypes = computed(() =>
    this.prestationsTypesWeek().map(item => item.label).filter(Boolean)
  );
  readonly prestationsTrendTypesShort = computed(() =>
    this.prestationsTrendTypes().slice(0, 4)
  );
  readonly topPrestations = computed(() => this.prestationsTypes().slice(0, 4));
  readonly executionRate = computed(() => {
    const month = Number(this.stats()?.prestationsMonth ?? 0);
    if (!month) return 0;
    return Math.min(100, Math.round((this.prestationsTypesWeekTotal() / month) * 100));
  });
  readonly auditInsight = computed(() => this.buildAuditInsight(this.auditItems()));
  readonly moduleCards = computed(() => [
    {
      key: 'import',
      title: 'Import CSV Osiris',
      icon: 'upload_file',
      tone: 'blue',
      status: 'Actif',
      metric: `${this.formatCount(this.todayInterventionsCount())} interventions du jour`,
      detail: 'Import, fusion et lecture du flux terrain sans intégration officielle.',
      action: 'Ouvrir import',
      route: ['/admin/interventions/import']
    },
    {
      key: 'dashboard',
      title: 'Dashboard interventions',
      icon: 'insights',
      tone: 'green',
      status: 'Pilotage',
      metric: `${this.formatCount(this.prestationsTypesWeekTotal())} prestations cette semaine`,
      detail: 'Lecture immédiate du volume, des tendances 7 jours et des priorités terrain.',
      action: 'Voir le cockpit',
      route: ['/admin/interventions/week']
    },
    {
      key: 'failures',
      title: 'Analyse des échecs',
      icon: 'crisis_alert',
      tone: 'amber',
      status: 'DB + CSV',
      metric: this.auditTotals()
        ? `${this.formatCount(this.auditTotals()?.nbEchecs ?? 0)} échecs · ${this.auditTotals()?.txEchecGlobal ?? 0} % taux global`
        : 'Audit mensuel en chargement',
      detail: this.auditInsight().riskiestTechnician
        ? `Alerte prioritaire : ${this.auditInsight().riskiestTechnician} (score ${this.auditInsight().riskiestScore}, ${this.auditInsight().riskiestFailures} échecs, ${this.auditInsight().riskiestRate} %). Zone la plus touchée : ${this.auditInsight().riskiestRegion} (${this.formatCount(this.auditInsight().regionFailures)} échecs). Top motif : ${this.auditTopMotif() || 'n/d'}.`
        : (this.auditTopMotif()
          ? `Top motif du mois : ${this.auditTopMotif()}. Vue détaillée par technicien, base et fichier Osiris.`
          : 'Vue détaillée par technicien, base et fichier Osiris pour isoler rapidement les échecs critiques.'),
      action: 'Auditer',
      route: ['/admin/interventions/audit']
    },
    {
      key: 'technicians',
      title: 'Gestion techniciens',
      icon: 'engineering',
      tone: 'violet',
      status: 'Actif',
      metric: `${this.formatCount(this.todayAbsentTechniciansCount())} indisponibilité(s) aujourd'hui`,
      detail: 'Suivi d activité, interventions et absences depuis un point d entrée unique.',
      action: 'Voir activité',
      route: ['/admin/technicians/activity']
    },
    {
      key: 'materials',
      title: 'Gestion matériel',
      icon: 'inventory_2',
      tone: 'slate',
      status: 'Stock',
      metric: `${this.formatCount((this.stats()?.totalLowStockMaterials ?? 0) + (this.stats()?.totalLowStockConsumables ?? 0))} alerte(s) stock · ${this.formatCount(this.materialInsight().topTechnicianQty)} unités affectées`,
      detail: this.materialInsight().topTechnician
        ? `Top consommation technicien : ${this.materialInsight().topTechnician} (${this.formatCount(this.materialInsight().topTechnicianQty)} unités). PTO : ${this.formatCount(this.materialInsight().ptoQty)} · JARRETIÈRES : ${this.formatCount(this.materialInsight().jarretiereQty)}.`
        : `PTO : ${this.formatCount(this.materialInsight().ptoQty)} · JARRETIÈRES : ${this.formatCount(this.materialInsight().jarretiereQty)}. Objectif : réduire les pertes et mieux lire la consommation terrain.`,
      action: 'Voir consommation',
      route: ['/admin/resources/material-consumption']
    },
    {
      key: 'compliance',
      title: 'Mini conformité',
      icon: 'verified_user',
      tone: 'rose',
      status: 'Phase 2',
      metric: `${this.formatCount(this.pendingAbsenceCount())} demande(s) RH en attente`,
      detail: 'Socle RH présent, à étendre avec documents techniciens et alertes expiration.',
      action: 'Ouvrir RH',
      route: ['/admin/hr']
    }
  ]);
  readonly prestationsDonut = computed(() => {
    const items = this.prestationsTypes();
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (!items.length || total <= 0) {
      return { total: 0, segments: [], gradient: 'conic-gradient(#1f2a3d 0 100%)' };
    }
    let acc = 0;
    const segments = items.map((item) => {
      const share = (item.value / total) * 100;
      const start = acc;
      acc += share;
      const length = (share / 100) * this.donutCircumference;
      const dashArray = `${length} ${this.donutCircumference - length}`;
      const dashOffset = this.donutCircumference * (1 - start / 100);
      return { ...item, share, start, end: acc };
    });
    const enrichedSegments = segments.map((seg) => {
      const length = (seg.share / 100) * this.donutCircumference;
      const dashArray = `${length} ${this.donutCircumference - length}`;
      const dashOffset = this.donutCircumference * (1 - seg.start / 100);
      return { ...seg, dashArray, dashOffset };
    });
    const gradient = `conic-gradient(${segments
      .map((seg) => `${seg.color} ${seg.start.toFixed(2)}% ${seg.end.toFixed(2)}%`)
      .join(', ')})`;
    return { total, segments: enrichedSegments, gradient };
  });

  readonly isDirigeant = computed(() => this.auth.getUserRole() === Role.DIRIGEANT);
  readonly canManageAccess = computed(() => {
    const role = this.auth.getUserRole();
    return role === Role.DIRIGEANT || role === Role.ADMIN;
  });
  readonly canViewHr = computed(() => this.canManageAccess());

  ngOnInit(): void {
    // Charge les stats du dashboard au chargement de la page
    this.adminService.loadDashboardStats();
    this.absenceService.refreshPendingCount();

    this.adminService.getWeeklyPrestationsTrend(7).subscribe({
      next: (res) => {
        const days = res?.days ?? [];
        const rangeEnd = res?.range?.to;
        this.prestationsTrend.set(this.mapTrendDays(days, 7, rangeEnd));
      },
      error: () => {
        this.prestationsTrend.set([]);
      }
    });

    this.adminService.getPrestationsTypesSummary(30).subscribe({
      next: (res) => {
        const items = res?.items ?? [];
        this.prestationsTypesRange.set(res?.range ?? null);
        this.prestationsTypes.set(this.mapTypesSummary(items));
      },
      error: () => {
        this.prestationsTypes.set([]);
        this.prestationsTypesRange.set(null);
      }
    });

    this.adminService.getPrestationsTypesSummary(7).subscribe({
      next: (res) => {
        const items = res?.items ?? [];
        this.prestationsTypesWeek.set(this.mapTypesSummary(items));
      },
      error: () => {
        this.prestationsTypesWeek.set([]);
      }
    });

    // Charge l'historique global (tu peux rajouter des filtres plus tard)
    this.adminService.refreshHistory({}, true).subscribe({
      error: () => {
        // l'erreur est déjà stockée dans le signal error(), rien à faire ici
      }
    });

    const today = this.todayInput();

    this.interventions.importSummaryTechnician({ fromDate: today, toDate: today }).subscribe({
      next: (res) => {
        this.todayInterventionsCount.set(Number(res?.data?.totals?.total ?? res?.data?.total ?? 0));
      },
      error: () => {
        this.todayInterventionsCount.set(0);
      }
    });

    this.absenceService.list({ fromDate: today, toDate: today }).subscribe({
      next: (res) => {
        const active = (res?.data ?? []).filter(item => item.status !== 'REFUSE');
        this.todayAbsentTechniciansCount.set(active.length);
      },
      error: () => {
        this.todayAbsentTechniciansCount.set(0);
      }
    });

    this.interventions.auditEchecs({
      fromDate: this.firstDayOfCurrentMonth(),
      toDate: this.lastDayOfCurrentMonth()
    }).subscribe({
      next: (res) => {
        this.auditItems.set(res?.data?.items ?? []);
        this.auditTotals.set(res?.data?.totals ?? null);
        this.auditTopMotif.set(res?.data?.topMotifs?.[0]?.motif ?? null);
      },
      error: () => {
        this.auditItems.set([]);
        this.auditTotals.set(null);
        this.auditTopMotif.set(null);
      }
    });

    forkJoin([
      this.movementService.listRaw({
        resourceType: 'CONSUMABLE',
        action: 'ASSIGN',
        toType: 'USER',
        fromDate: this.firstDayOfCurrentMonth(),
        toDate: this.lastDayOfCurrentMonth(),
        page: 1,
        limit: 500
      }),
      this.movementService.listRaw({
        resourceType: 'MATERIAL',
        action: 'ASSIGN',
        toType: 'USER',
        fromDate: this.firstDayOfCurrentMonth(),
        toDate: this.lastDayOfCurrentMonth(),
        page: 1,
        limit: 500
      })
    ]).subscribe({
      next: ([consumables, materials]) => {
        this.materialInsight.set(this.buildMaterialInsight([
          ...(consumables.items ?? []),
          ...(materials.items ?? [])
        ]));
      },
      error: () => {
        this.materialInsight.set({
          topTechnician: null,
          topTechnicianQty: 0,
          ptoQty: 0,
          jarretiereQty: 0
        });
      }
    });
  }

  // Navigation rapide depuis les cartes du dashboard
  goToUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  goToDepots(): void {
    this.router.navigate(['/admin/depots']);
  }

  goToResources(type?: 'materials' | 'consumables' | 'vehicles'): void {
    if (type) {
      this.router.navigate(['/admin/resources', type]);
    } else {
      this.router.navigate(['/admin/resources']);
    }
  }

  goToHistory(): void {
    this.router.navigate(['/admin/history']);
  }

  goToOnboarding(): void {
    this.router.navigate(['/admin/onboarding']);
  }

  goToDirigeant(): void {
    this.router.navigate(['/admin/dirigeant']);
  }

  goToAgenda(): void {
    this.router.navigate(['/admin/agenda']);
  }

  goToDepotDashboard(): void {
    this.router.navigate(['/depot']);
  }

  goToStockAlerts(): void {
    this.router.navigate(['/admin/alerts/stock']);
  }

  goToAbsences(): void {
    this.router.navigate(['/admin/hr'], { queryParams: { tab: 'leaves' } });
  }

  scrollToTrend(): void {
    const el = document.getElementById('radar-interventions');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  goToNewUser(): void {
    this.router.navigate(['/admin/users/new']);
  }

  goToNewDepot(): void {
    this.router.navigate(['/admin/depots/new']);
  }

  goToNewOrder(): void {
    this.router.navigate(['/admin/orders/new']);
  }

  goToInterventions(): void {
    this.router.navigate(['/admin/interventions']);
  }

  goToUserAccess(): void {
    this.router.navigate(['/admin/security/user-access']);
  }

  goToHr(): void {
    this.router.navigate(['/admin/hr']);
  }

  goToInterventionsImport(): void {
    this.router.navigate(['/admin/interventions/import']);
  }

  goToMovements(): void {
    this.router.navigate(['/admin/history']);
  }

  goToTechnicianActivity(): void {
    this.router.navigate(['/admin/technicians/activity']);
  }

  goToTechnicianInterventions(): void {
    this.router.navigate(['/admin/technicians/interventions']);
  }

  goToInterventionsAudit(): void {
    this.router.navigate(['/admin/interventions/audit']);
  }

  openModule(route: string[]): void {
    this.router.navigate(route);
  }

  trackHistory(index: number, item: HistoryItem): string {
    return (item as any).id || `${index}`;
  }

  formatCount(value: number | null | undefined): string {
    const safeValue = Math.max(0, Number(value ?? 0));
    return this.numberFormat.format(safeValue);
  }

  formatPercent(value: number | null | undefined): string {
    const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
    return `${safeValue.toFixed(1).replace('.', ',')}%`;
  }

  formatTrendLegend(types?: { key: string; label: string }[]): string {
    if (!types?.length) return '';
    const preferred = [
      { keys: ['racpros', 'racpro s', 'racpros'], labelMatch: 'RAC PRO S' },
      { keys: ['racproc', 'racpro c', 'racproc'], labelMatch: 'RAC PRO C' },
      { keys: ['racpav', 'racpavillon', 'rac pav'], labelMatch: 'RAC PAV' },
      { keys: ['racih', 'racimmeuble', 'rac immeuble', 'racf8'], labelMatch: 'RAC IMMEUBLE' },
      { keys: ['reco', 'reconnexion'], labelMatch: 'RECO' },
      { keys: ['sav'], labelMatch: 'SAV' },
      { keys: ['presta_compl', 'prestacompl', 'presta compl'], labelMatch: 'PRESTA COMPL' }
    ];

    const byKey = new Map(
      types.map(type => [this.normalizeKey(type.key), type.label])
    );
    const byLabel = new Map(
      types.map(type => [this.normalizeKey(type.label), type.label])
    );

    const picks: string[] = [];
    const pickedLabels = new Set<string>();
    for (const pref of preferred) {
      const matchKey = pref.keys.find(key => byKey.has(this.normalizeKey(key))) ||
        pref.keys.find(key => byLabel.has(this.normalizeKey(key)));
      if (matchKey) {
        const label = byKey.get(this.normalizeKey(matchKey)) || byLabel.get(this.normalizeKey(matchKey));
        if (label) {
          const normalizedLabel = this.normalizeKey(label);
          if (!pickedLabels.has(normalizedLabel)) {
            picks.push(label);
            pickedLabels.add(normalizedLabel);
          }
        }
      }
    }

    if (picks.length) return picks.join(' · ');
    return types.slice(0, 3).map(type => type.label).join(' · ');
  }

  private todayInput(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildAuditInsight(items: DashboardAuditItem[]): DashboardAuditInsight {
    if (!items.length) {
      return {
        riskiestTechnician: null,
        riskiestRate: null,
        riskiestFailures: 0,
        riskiestScore: 0,
        riskiestRegion: null,
        regionFailures: 0
      };
    }

    const maxFailures = Math.max(...items.map((item) => Number(item.echecs?.length || 0)), 1);
    const scored = items
      .map((item) => {
        const failures = Math.max(0, Number(item.echecs?.length || 0));
        const rate = Math.max(0, Number(item.txEchecGlobal || 0));
        return {
          ...item,
          failures,
          rate,
          score: this.scoreAuditRisk(item, maxFailures)
        };
      })
      .filter((item) => item.failures > 0);

    const riskiest = [...scored].sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      const failureDiff = b.failures - a.failures;
      if (failureDiff !== 0) return failureDiff;
      return b.rate - a.rate;
    })[0];

    const regionMap = new Map<string, number>();
    for (const item of items) {
      const region = String(item.region || '').trim() || 'Non renseignee';
      regionMap.set(region, (regionMap.get(region) || 0) + Number(item.echecs?.length || 0));
    }
    const riskiestRegionEntry = [...regionMap.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      riskiestTechnician: riskiest?.technician || null,
      riskiestRate: riskiest?.rate ?? null,
      riskiestFailures: riskiest?.failures ?? 0,
      riskiestScore: riskiest?.score ?? 0,
      riskiestRegion: riskiestRegionEntry?.[0] || null,
      regionFailures: riskiestRegionEntry?.[1] || 0
    };
  }

  private buildMaterialInsight(items: Movement[]): {
    topTechnician: string | null;
    topTechnicianQty: number;
    ptoQty: number;
    jarretiereQty: number;
  } {
    if (!items.length) {
      return {
        topTechnician: null,
        topTechnicianQty: 0,
        ptoQty: 0,
        jarretiereQty: 0
      };
    }

    const totalsByTechnician = new Map<string, number>();
    let ptoQty = 0;
    let jarretiereQty = 0;

    for (const item of items) {
      const qty = Math.max(0, Number(item.quantity || 0));
      const technician = String(item.toLabel || item.authorName || item.to?.id || '').trim() || 'Technicien non renseigne';
      totalsByTechnician.set(technician, (totalsByTechnician.get(technician) || 0) + qty);

      const label = this.normalizeKey(item.resourceLabel || item.resourceId || '');
      if (label.includes('pto')) {
        ptoQty += qty;
      }
      if (label.includes('jarretiere') || label.includes('jarretière') || label.includes('jarret')) {
        jarretiereQty += qty;
      }
    }

    const topTechnicianEntry = [...totalsByTechnician.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      topTechnician: topTechnicianEntry?.[0] || null,
      topTechnicianQty: topTechnicianEntry?.[1] || 0,
      ptoQty,
      jarretiereQty
    };
  }

  private scoreAuditRisk(item: DashboardAuditItem, maxFailures: number): number {
    const total = Math.max(0, Number(item.nbTotal || 0));
    const failures = Math.max(0, Number(item.echecs?.length || 0));
    const rate = Math.max(0, Number(item.txEchecGlobal || 0));
    const volumeFactor = Math.min(total / 12, 1);
    const failureWeight = failures / Math.max(1, maxFailures);

    return Math.round(((rate * 0.6) + (failureWeight * 100 * 0.3) + (volumeFactor * 100 * 0.1)) * 10) / 10;
  }

  private firstDayOfCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}-01`;
  }

  private lastDayOfCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const month = `${monthIndex + 1}`.padStart(2, '0');
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  }

  private mapTrendDays(
    days: { date: string; count: number; types?: { key: string; count: number }[] }[],
    span = 7,
    rangeEnd?: string
  ) {
    const normalizedSpan = Math.max(1, Math.min(30, Math.floor(span)));
    const countsByDate = new Map<string, number>();
    const hasCountByDate = new Map<string, boolean>();
    const typesByDate = new Map<string, { key: string; count: number }[]>();
    for (const item of days) {
      const key = this.toLocalDateKey(this.parseLocalDate(item.date));
      const hasCount = item.count !== undefined && item.count !== null;
      countsByDate.set(key, Number(item.count ?? 0));
      hasCountByDate.set(key, hasCount);
      if (item.types?.length) {
        typesByDate.set(key, item.types);
      }
    }

    const dates: string[] = [];
    const endDate = rangeEnd ? this.parseLocalDate(rangeEnd) : new Date();
    for (let offset = normalizedSpan - 1; offset >= 0; offset -= 1) {
      const date = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - offset);
      dates.push(this.toLocalDateKey(date));
    }

    const mapped = dates.map((dateKey) => {
      const date = new Date(dateKey);
      const label = date.toLocaleDateString('fr-FR', { weekday: 'short' });
      const tooltip = date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
      let value = countsByDate.get(dateKey) ?? 0;
      const rawTypesAll = typesByDate.get(dateKey) || [];
      const totalTypesAll = rawTypesAll.reduce((sum, type) => sum + Number(type.count || 0), 0);
      const rawTypes = rawTypesAll
        .slice()
        .filter((type) => {
          const key = String(type.key || '');
          const normalized = this.normalizeKey(key);
          return normalized &&
            normalized !== 'autre' &&
            normalized !== 'other' &&
            normalized !== 'clem' &&
            !normalized.startsWith('cablepav') &&
            normalized !== 'savexp';
        })
        .sort((a, b) => b.count - a.count);
      const mergedByLabel = new Map<string, { key: string; label: string; count: number }>();
      for (const type of rawTypes) {
        const label = this.formatTypeLabel(type.key);
        const labelKey = this.normalizeKey(label);
        const existing = mergedByLabel.get(labelKey);
        if (existing) {
          existing.count += Number(type.count || 0);
        } else {
          mergedByLabel.set(labelKey, {
            key: type.key,
            label,
            count: Number(type.count || 0)
          });
        }
      }
      const types = Array.from(mergedByLabel.values())
        .sort((a, b) => b.count - a.count)
        .map((type) => ({
          ...type,
          color: this.pickTypeColor(type.label),
          percent: 0,
          shortLabel: this.shortTypeLabel(type.label)
        }));
      const totalTypes = types.reduce((sum, type) => sum + Number(type.count || 0), 0) || 0;
      const hasCount = hasCountByDate.get(dateKey) ?? false;
      if (types.length) {
        value = totalTypes;
      } else if (!hasCount && totalTypesAll > 0) {
        value = totalTypesAll;
      }
      let percentSum = 0;
      for (const type of types) {
        type.percent = totalTypes
          ? Math.max(0, Math.round((Number(type.count || 0) / totalTypes) * 100))
          : 0;
        percentSum += type.percent;
      }
      if (types.length && percentSum !== 100) {
        types[0].percent = Math.max(0, types[0].percent + (100 - percentSum));
      }
      const primaryTypeLabel = types[0]?.label;
      const typesLabel = types.length
        ? ` • ${types.map(type => `${type.label} (${this.formatCount(type.count)})`).join(', ')}`
        : '';
      return {
        key: dateKey,
        label,
        tooltip: `${tooltip}${typesLabel}`,
        value,
        primaryTypeLabel,
        types
      };
    });

    const max = Math.max(...mapped.map(item => item.value), 1);
    return mapped.map(item => ({
      ...item,
      percent: Math.round((item.value / max) * 100)
    }));
  }

  private normalizeKey(value: string | undefined | null): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[_\s-]/g, '');
  }

  private toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mapTypesSummary(items: { key: string; count: number }[]) {
    const ordered = items
      .filter(item => {
        if (!item.key) return false;
        const key = item.key.toLowerCase();
        const normalized = key.replace(/[_\s-]/g, '');
        if (normalized.startsWith('cablepav')) return false;
        if (normalized === 'clem') return false;
        return key !== 'autre' && key !== 'other';
      })
      .sort((a, b) => b.count - a.count);
    const max = Math.max(...ordered.map(item => item.count), 1);
    return ordered.map((item) => ({
      key: item.key,
      label: this.formatTypeLabel(item.key),
      value: item.count,
      percent: Math.round((item.count / max) * 100),
      color: this.pickTypeColor(item.key)
    }));
  }

  private formatTypeLabel(key: string): string {
    const map: Record<string, string> = {
      racProS: 'RAC PRO S',
      racProC: 'RAC PRO C',
      racPavillon: 'RAC PAV',
      racImmeuble: 'RAC IMMEUBLE',
      racF8: 'PRESTATION F8',
      refrac: 'REFRAC',
      reconnexion: 'RECO',
      clem: 'CLEM',
      prestaCompl: 'PRESTA COMPL',
      deprise: 'DEPRISE',
      demo: 'DEMO',
      sav: 'SAV',
      savExp: 'SAV EXP',
      refcDgr: 'REFC DGR',
      racAutre: 'RAC AUTRE',
      cablePav1: 'CABLE PAV 1',
      cablePav2: 'CABLE PAV 2',
      cablePav3: 'CABLE PAV 3',
      cablePav4: 'CABLE PAV 4',
      cablePavOther: 'CABLE PAV SL'
    };

    if (map[key]) return map[key];
    return key.replace(/_/g, ' ').toUpperCase();
  }

  private shortTypeLabel(label: string): string {
    const raw = String(label || '').trim();
    if (!raw) return '';
    const normalized = this.normalizeKey(raw);
    const map: Record<string, string> = {
      pros: 'PS',
      proc: 'PC',
      racpav: 'PAV',
      racpavillon: 'PAV',
      racih: 'IMM',
      racimmeuble: 'IMM',
      prestacompl: 'PRESTA',
      presta_compl: 'PRESTA',
      recoip: 'RECO',
      reconnexion: 'RECO',
      sav: 'SAV'
    };
    if (map[normalized]) return map[normalized];
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return raw.slice(0, 6).toUpperCase();
    }
    const initials = words.map(w => w[0]).join('');
    return initials.slice(0, 4).toUpperCase();
  }

  private pickTypeColor(key: string): string {
    const normalized = this.normalizeKey(key);
    if (!normalized) return this.donutPalette[0];
    const colorOverrides: Record<string, string> = {
      // RAC fibre aérien / souterrain
      racpboaerien:   '#F97316', // orange
      racpbosout:     '#34D399', // emerald
      // RAC Pro / Pavillon / Immeuble
      racpros:        '#6BA4FF', // blue
      racproc:        '#2BD4A8', // teal
      racpavillon:    '#F59E0B', // amber
      racimmeuble:    '#8B5CF6', // violet
      racf8:          '#38BDF8', // sky
      racautre:       '#94A3B8', // slate
      // Reconnexion / RECO
      reconnexion:    '#22C55E', // green
      recoip:         '#16A34A', // dark green
      // PLV
      plvpros:        '#A855F7', // purple
      plvproc:        '#C084FC', // light purple
      // SAV
      sav:            '#60A5FA', // light blue
      savexp:         '#FB7185', // rose
      // Autres types courants
      prestacompl:    '#E879F9', // fuchsia
      deprise:        '#64748B', // slate-blue
      demo:           '#A78BFA', // lavender
      refrac:         '#F43F5E', // red
      refcdgr:        '#EF4444', // crimson
      deplacementof:  '#0EA5E9', // sky blue
      deplacementoffice: '#0EA5E9',
      // Câbles Pav (normalement filtrés mais au cas où)
      cablepav1:      '#CBD5E1',
      cablepav2:      '#B0BEC5',
      cablepav3:      '#90A4AE',
      cablepav4:      '#78909C',
    };
    if (colorOverrides[normalized]) return colorOverrides[normalized];
    // Fallback : assignation séquentielle — chaque type inconnu reçoit une couleur unique
    if (this._dynamicColorCache.has(normalized)) {
      return this._dynamicColorCache.get(normalized)!;
    }
    const usedColors = new Set([
      ...Object.values(colorOverrides),
      ...this._dynamicColorCache.values()
    ]);
    let color = this._fallbackPalette[this._dynamicColorIndex % this._fallbackPalette.length];
    let attempts = 0;
    while (usedColors.has(color) && attempts < this._fallbackPalette.length) {
      this._dynamicColorIndex++;
      attempts++;
      color = this._fallbackPalette[this._dynamicColorIndex % this._fallbackPalette.length];
    }
    this._dynamicColorIndex++;
    this._dynamicColorCache.set(normalized, color);
    return color;
  }

  private parseLocalDate(value: string | undefined): Date {
    if (!value) return new Date();
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      const [year, month, day] = parts;
      return new Date(year, month - 1, day);
    }
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
  }
}
