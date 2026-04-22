import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  InterventionService,
  InterventionSummaryItem,
  InterventionTotals
} from '../../../core/services/intervention.service';
import { HrService } from '../../../core/services/hr.service';
import { EmployeeSummary } from '../../../core/models';
import { apiError } from '../../../core/utils/http-error';
import { formatPersonName } from '../../../core/utils/text-format';

// ─── Types locaux ────────────────────────────────────────────────────────────

type TechRow = InterventionSummaryItem & {
  pct: number;
  techKey: string;
  techAliases: string[];
};

type PrestationSlice = {
  label: string;
  key: keyof InterventionTotals;
  color: string;
  value: number;
  pct: number;
  offset: number;
};

// ─── Helpers semaine ─────────────────────────────────────────────────────────

function toIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

function currentWeekBounds(): { from: string; to: string; label: string } {
  const today = new Date();
  const day = today.getDay(); // 0 = dimanche
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  return {
    from: toIso(monday),
    to: toIso(sunday),
    label: `Semaine du ${fmt(monday)} au ${fmt(sunday)}`
  };
}

// ─── Palette donut ───────────────────────────────────────────────────────────

const DONUT_COLORS = [
  '#0ec9ca', '#10d48a', '#f59e0b', '#f0546c',
  '#4aa3ff', '#a78bfa', '#fb923c', '#34d399'
];

const PRESTA_SLICES: Array<{ label: string; key: keyof InterventionTotals }> = [
  { label: 'RACPAV',        key: 'racPavillon'     },
  { label: 'RACIH',         key: 'racImmeuble'     },
  { label: 'RECOIP',        key: 'reconnexion'     },
  { label: 'RAC_PBO_SOUT',  key: 'racSouterrain'   },
  { label: 'RAC_PBO_AERIEN', key: 'racAerien'       },
  { label: 'RAC_PBO_FACADE', key: 'racFacade'       },
  { label: 'RACPRO_S',      key: 'racProS'         },
  { label: 'SAV',           key: 'sav'             },
  { label: 'CLEM',          key: 'clem'            },
  { label: 'DEPLPRISE',     key: 'deplacementPrise'},
  { label: 'Autres',        key: 'racAutre'        },
];

// ─── Composant ───────────────────────────────────────────────────────────────

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-week-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './week-dashboard.html',
  styleUrls: ['./week-dashboard.scss']
})
export class WeekDashboard implements OnInit {
  private svc = inject(InterventionService);
  private hr = inject(HrService);

  readonly week = currentWeekBounds();
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly techRows = signal<TechRow[]>([]);
  readonly totals = signal<InterventionTotals | null>(null);
  readonly totalAll = signal(0);

  // ─── Donut chart (SVG) ───────────────────────────────────────────────────

  readonly donutR = 70;
  readonly donutCx = 90;
  readonly donutCy = 90;
  readonly donutCirc = 2 * Math.PI * this.donutR;

  readonly donutSlices = computed<PrestationSlice[]>(() => {
    const t = this.totals();
    if (!t) return [];
    const grand = this.totalAll();
    if (!grand) return [];

    let cursor = 0;
    const result: PrestationSlice[] = [];

    PRESTA_SLICES.forEach(({ label, key }, i) => {
      const val = (t[key] as number | undefined) ?? 0;
      if (!val) return;
      const pct = val / grand;
      result.push({
        label,
        key,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
        value: val,
        pct,
        offset: this.donutCirc * (1 - cursor)
      });
      cursor += pct;
    });

    return result;
  });

  // ─── Computed KPIs ───────────────────────────────────────────────────────

  readonly activeTechCount = computed(() => this.techRows().filter(t => t.total > 0).length);

  readonly topTech = computed(() => {
    const rows = this.techRows();
    if (!rows.length) return null;
    return rows.reduce((best, t) => (t.total > best.total ? t : best), rows[0]);
  });

  readonly topPresta = computed<{ label: string; value: number } | null>(() => {
    const slices = this.donutSlices();
    if (!slices.length) return null;
    return slices.reduce(
      (best, s) => (s.value > best.value ? s : best),
      slices[0]
    );
  });

  // ─── Synthèse prestations (toutes celles > 0, data-driven) ──────────────

  readonly prestaCells = computed(() => {
    const t = this.totals();
    const grand = this.totalAll();
    if (!t || !grand) return [];
    return PRESTA_SLICES
      .map(({ label, key }, i) => ({
        label,
        value: (t[key] as number | undefined) ?? 0,
        color: DONUT_COLORS[i % DONUT_COLORS.length]
      }))
      .filter(c => c.value > 0)
      .map(c => ({ ...c, pct: (c.value / grand) * 100 }));
  });

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [resp, employees] = await Promise.all([
        firstValueFrom(
          this.svc.summary({ fromDate: this.week.from, toDate: this.week.to, limit: 200 })
        ),
        firstValueFrom(this.hr.listEmployees({ role: 'TECHNICIEN', page: 1, limit: 1000 }))
          .then((res) => res.items ?? [])
          .catch(() => [] as EmployeeSummary[])
      ]);
      const data = resp.data;
      const items: InterventionSummaryItem[] = data.items ?? [];
      const t: InterventionTotals = data.totals;
      const grand = t?.total ?? items.reduce((s, x) => s + x.total, 0);
      const sorted = this.aggregateTechnicians(items, employees)
        .sort((a, b) => b.total - a.total)
        .map(row => ({ ...row, pct: grand ? (row.total / grand) * 100 : 0 }));

      this.techRows.set(sorted);
      this.totals.set(t ?? null);
      this.totalAll.set(grand);
    } catch (err: any) {
      this.error.set(apiError(err, 'Impossible de charger les données'));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Template helpers ────────────────────────────────────────────────────

  barWidth(pct: number): string {
    return `${Math.min(100, pct).toFixed(1)}%`;
  }

  strokeDash(slice: PrestationSlice): string {
    return `${(slice.pct * this.donutCirc).toFixed(2)} ${this.donutCirc.toFixed(2)}`;
  }

  strokeOffset(slice: PrestationSlice): string {
    return `${slice.offset.toFixed(2)}`;
  }

  donutTransform(): string {
    return `rotate(-90 ${this.donutCx} ${this.donutCy})`;
  }

  pctLabel(v: number): string {
    return `${v.toFixed(1)} %`;
  }

  slicePctLabel(slice: PrestationSlice): string {
    return `${(slice.pct * 100).toFixed(0)}%`;
  }

  cellPctLabel(pct: number): string {
    return `${pct.toFixed(0)}%`;
  }

  trackByCell(_: number, c: { label: string }): string {
    return c.label;
  }

  techTotal(row: TechRow): number {
    return row.total;
  }

  techName(row: TechRow): string {
    return row.technician || 'Inconnu';
  }

  topTechName(): string {
    return this.topTech()?.technician ?? '—';
  }

  topTechTotal(): number {
    return this.topTech()?.total ?? 0;
  }

  topPrestaLabel(): string {
    return this.topPresta()?.label ?? '—';
  }

  topPrestaValue(): number {
    return this.topPresta()?.value ?? 0;
  }

  hasError(): boolean {
    return !!this.error();
  }

  hasData(): boolean {
    return !this.loading() && !this.error() && this.totalAll() > 0;
  }

  isEmpty(): boolean {
    return !this.loading() && !this.error() && this.totalAll() === 0;
  }

  trackByTech(_: number, row: TechRow): string {
    return row.techKey;
  }

  trackBySlice(_: number, s: PrestationSlice): string {
    return s.label;
  }

  // ─── Helpers par technicien ──────────────────────────────────────────────
  techRacProC(row: TechRow): number     { return row.racProC          ?? 0; }
  techRacProS(row: TechRow): number     { return row.racProS          ?? 0; }
  techRacAerien(row: TechRow): number   { return row.racAerien        ?? 0; }
  techRacFacade(row: TechRow): number   { return row.racFacade        ?? 0; }
  techRacSout(row: TechRow): number     { return row.racSouterrain    ?? 0; }
  techRacIh(row: TechRow): number       { return row.racImmeuble      ?? 0; }
  techReco(row: TechRow): number        { return row.reconnexion      ?? 0; }
  techDeplTort(row: TechRow): number    { return row.deplacementATort  ?? 0; }
  techDeplOffert(row: TechRow): number  { return row.deplacementOffert ?? 0; }
  techAutre(row: TechRow): number       { return row.racAutre         ?? 0; }

  // ─── Totaux colonne ──────────────────────────────────────────────────────
  totalRacProC(): number    { return this.totals()?.racProC          ?? 0; }
  totalRacProS(): number    { return this.totals()?.racProS          ?? 0; }
  totalRacAerien(): number  { return this.totals()?.racAerien        ?? 0; }
  totalRacFacade(): number  { return this.totals()?.racFacade        ?? 0; }
  totalRacSout(): number    { return this.totals()?.racSouterrain    ?? 0; }
  totalRacIh(): number      { return this.totals()?.racImmeuble      ?? 0; }
  totalReco(): number       { return this.totals()?.reconnexion      ?? 0; }
  totalDeplTort(): number   { return this.totals()?.deplacementATort  ?? 0; }
  totalDeplOffert(): number { return this.totals()?.deplacementOffert ?? 0; }
  totalAutre(): number      { return this.totals()?.racAutre         ?? 0; }

  techFilter(row: TechRow): string {
    const aliases = Array.from(new Set(
      row.techAliases
        .map((value) => this.cleanTechLabel(value))
        .filter(Boolean)
    ));
    if (!aliases.length) return '';
    const escaped = aliases.map((value) => this.escapeRegex(value));
    return `^(?:${escaped.join('|')})$`;
  }

  private aggregateTechnicians(items: InterventionSummaryItem[], employees: EmployeeSummary[]): TechRow[] {
    const grouped = new Map<string, TechRow>();
    const directMap = this.buildDirectTechMap(employees);
    const lastNameMap = this.buildUniqueLastNameMap(employees);
    const summarySuffixMap = this.buildSummarySuffixMap(items);

    for (const item of items) {
      const rawLabel = this.cleanTechLabel(item.technician);
      const resolvedLabel = this.resolveTechLabel(rawLabel, directMap, lastNameMap, summarySuffixMap);
      const techKey = this.normalizeLabel(resolvedLabel || rawLabel || 'Inconnu');
      const displayLabel = resolvedLabel || rawLabel || 'Inconnu';
      const bucket = grouped.get(techKey) ?? {
        ...this.cloneSummaryItem(item, displayLabel),
        pct: 0,
        techKey,
        techAliases: rawLabel ? [rawLabel] : []
      };

      if (bucket !== grouped.get(techKey)) {
        grouped.set(techKey, bucket);
      } else {
        this.mergeSummaryItem(bucket, item);
        bucket.technician = this.pickPreferredLabel(bucket.technician, displayLabel);
        if (rawLabel && !bucket.techAliases.includes(rawLabel)) bucket.techAliases.push(rawLabel);
      }
    }

    return Array.from(grouped.values());
  }

  private cloneSummaryItem(item: InterventionSummaryItem, technician: string): TechRow {
    return {
      ...item,
      technician,
      pct: 0,
      techKey: this.normalizeLabel(technician || 'Inconnu'),
      techAliases: []
    };
  }

  private mergeSummaryItem(target: InterventionSummaryItem, source: InterventionSummaryItem): void {
    for (const [key, value] of Object.entries(source)) {
      if (key === 'technician' || typeof value !== 'number') continue;
      const current = typeof (target as Record<string, unknown>)[key] === 'number'
        ? Number((target as Record<string, unknown>)[key])
        : 0;
      (target as Record<string, unknown>)[key] = current + value;
    }
  }

  private buildDirectTechMap(employees: EmployeeSummary[]): Map<string, string> {
    const result = new Map<string, string>();
    for (const entry of employees) {
      const user = entry.user;
      const label = formatPersonName(user?.firstName ?? '', user?.lastName ?? '') || user?.email || '';
      const normalized = this.normalizeLabel(label);
      if (!normalized) continue;
      result.set(normalized, label);
    }
    return result;
  }

  private buildUniqueLastNameMap(employees: EmployeeSummary[]): Map<string, string> {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    for (const entry of employees) {
      const user = entry.user;
      const lastName = this.normalizeLabel(user?.lastName ?? '');
      const label = formatPersonName(user?.firstName ?? '', user?.lastName ?? '') || user?.email || '';
      if (!lastName || !label) continue;
      counts.set(lastName, (counts.get(lastName) ?? 0) + 1);
      labels.set(lastName, label);
    }
    const result = new Map<string, string>();
    for (const [lastName, count] of counts.entries()) {
      if (count === 1) result.set(lastName, labels.get(lastName) || '');
    }
    return result;
  }

  private buildSummarySuffixMap(items: InterventionSummaryItem[]): Map<string, string> {
    const candidates = new Map<string, Set<string>>();
    for (const item of items) {
      const label = this.cleanTechLabel(item.technician);
      const normalized = this.normalizeLabel(label);
      if (!normalized.includes(' ')) continue;
      const parts = normalized.split(' ');
      const suffix = parts[parts.length - 1];
      if (!suffix) continue;
      if (!candidates.has(suffix)) candidates.set(suffix, new Set());
      candidates.get(suffix)?.add(label);
    }
    const result = new Map<string, string>();
    for (const [suffix, labels] of candidates.entries()) {
      if (labels.size === 1) result.set(suffix, Array.from(labels)[0]);
    }
    return result;
  }

  private resolveTechLabel(
    value: string,
    directMap: Map<string, string>,
    lastNameMap: Map<string, string>,
    summarySuffixMap: Map<string, string>
  ): string {
    const normalized = this.normalizeLabel(value);
    if (!normalized) return 'Inconnu';
    const exact = directMap.get(normalized);
    if (exact) return exact;
    if (!normalized.includes(' ')) {
      const byLastName = lastNameMap.get(normalized);
      if (byLastName) return byLastName;
      const bySummarySuffix = summarySuffixMap.get(normalized);
      if (bySummarySuffix) return bySummarySuffix;
    }
    return value;
  }

  private pickPreferredLabel(current: string, candidate: string): string {
    const currentLabel = this.cleanTechLabel(current);
    const nextLabel = this.cleanTechLabel(candidate);
    if (!currentLabel) return nextLabel || 'Inconnu';
    if (!nextLabel) return currentLabel;
    const currentParts = this.normalizeLabel(currentLabel).split(' ').filter(Boolean).length;
    const nextParts = this.normalizeLabel(nextLabel).split(' ').filter(Boolean).length;
    if (nextParts > currentParts) return nextLabel;
    if (nextParts === currentParts && nextLabel.length > currentLabel.length) return nextLabel;
    return currentLabel;
  }

  private cleanTechLabel(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  private normalizeLabel(value: string): string {
    return this.cleanTechLabel(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
