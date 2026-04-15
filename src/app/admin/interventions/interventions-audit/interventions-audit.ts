import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuditEchecItem,
  AuditEchecDetail,
  AuditTopMotif,
  InterventionService,
} from '../../../core/services/intervention.service';

type AuditMode = 'db' | 'csv';

@Component({
  selector: 'app-interventions-audit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './interventions-audit.html',
  styleUrl: './interventions-audit.scss',
})
export class InterventionsAudit {
  private interventionService = inject(InterventionService);
  private datePipe = inject(DatePipe);

  @ViewChild('csvInput') private csvInput?: ElementRef<HTMLInputElement>;

  // ── Mode ─────────────────────────────────────────────────────────────────────
  readonly mode = signal<AuditMode>('db');

  // ── Filtres (mode DB) ────────────────────────────────────────────────────────
  readonly currentYear = new Date().getFullYear();
  readonly years = Array.from({ length: 5 }, (_, i) => this.currentYear - i);
  readonly months = [
    { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },     { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },{ value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },{ value: '12', label: 'Décembre' },
  ];

  readonly filterYear   = signal(this.currentYear);
  readonly filterMonth  = signal(String(new Date().getMonth() + 1).padStart(2, '0'));
  readonly filterRegion  = signal('');
  readonly filterSociete = signal('');

  // ── Fichier CSV (mode CSV) ───────────────────────────────────────────────────
  readonly selectedFile  = signal<File | null>(null);
  readonly csvMeta       = signal<{ filename: string; rowsRead: number } | null>(null);

  // ── État commun ──────────────────────────────────────────────────────────────
  readonly loading     = signal(false);
  readonly error       = signal<string | null>(null);
  readonly items       = signal<AuditEchecItem[]>([]);
  readonly topMotifs   = signal<AuditTopMotif[]>([]);
  readonly totals      = signal<{ nbTotal: number; nbEchecs: number; txEchecGlobal: number } | null>(null);
  readonly expandedRow = signal<string | null>(null);

  // ── Computed ─────────────────────────────────────────────────────────────────
  readonly periodLabel = computed(() => {
    if (this.mode() === 'csv') {
      const meta = this.csvMeta();
      return meta ? meta.filename : 'Fichier CSV';
    }
    const m = this.months.find(x => x.value === this.filterMonth());
    return `${m?.label ?? ''} ${this.filterYear()}`;
  });

  readonly hasData = computed(() => this.items().length > 0);

  readonly maxMotifCount = computed(() =>
    this.topMotifs().reduce((max, m) => Math.max(max, m.count), 1)
  );

  constructor() {
    this.load();
  }

  // ── Changement de mode ───────────────────────────────────────────────────────
  switchMode(m: AuditMode): void {
    if (this.mode() === m) return;
    this.mode.set(m);
    this.resetResults();
    if (m === 'db') this.load();
  }

  // ── Mode DB : chargement depuis la base ──────────────────────────────────────
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.expandedRow.set(null);

    const year  = this.filterYear();
    const month = this.filterMonth();
    const lastDay = new Date(year, Number(month), 0).getDate();
    const fromDate = `${year}-${month}-01`;
    const toDate   = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    this.interventionService.auditEchecs({
      fromDate,
      toDate,
      region:  this.filterRegion()  || undefined,
      societe: this.filterSociete() || undefined,
    }).subscribe({
      next: (res) => {
        this.items.set(res?.data?.items ?? []);
        this.topMotifs.set(res?.data?.topMotifs ?? []);
        this.totals.set(res?.data?.totals ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || err?.message || 'Erreur chargement audit');
        this.loading.set(false);
      }
    });
  }

  // ── Mode CSV : sélection de fichier ──────────────────────────────────────────
  onFileClick(): void {
    // reset value pour pouvoir re-sélectionner le même fichier
    if (this.csvInput?.nativeElement) this.csvInput.nativeElement.value = '';
  }

  onFileChange(event: Event): void {
    const el = event.target instanceof HTMLInputElement ? event.target : null;
    const file = el?.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.error.set(null);
    if (!file) this.resetResults();
  }

  analyzeFile(): void {
    const file = this.selectedFile();
    if (!file) return;
    this.loading.set(true);
    this.error.set(null);
    this.expandedRow.set(null);
    this.csvMeta.set(null);

    this.interventionService.auditEchecsCsv(file).subscribe({
      next: (res) => {
        this.items.set(res?.data?.items ?? []);
        this.topMotifs.set(res?.data?.topMotifs ?? []);
        this.totals.set(res?.data?.totals ?? null);
        this.csvMeta.set(res?.data?.meta ?? { filename: file.name, rowsRead: 0 });
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || err?.message || 'Erreur analyse du fichier');
        this.loading.set(false);
      }
    });
  }

  clearFile(): void {
    this.selectedFile.set(null);
    if (this.csvInput?.nativeElement) this.csvInput.nativeElement.value = '';
    this.resetResults();
  }

  // ── Ligne expandée ───────────────────────────────────────────────────────────
  toggleRow(technician: string): void {
    this.expandedRow.set(this.expandedRow() === technician ? null : technician);
  }

  isExpanded(technician: string): boolean {
    return this.expandedRow() === technician;
  }

  // ── Code couleur ─────────────────────────────────────────────────────────────
  txClass(tx: number): string {
    if (tx === 0) return 'tx-zero';
    if (tx < 10)  return 'tx-good';
    if (tx < 20)  return 'tx-warn';
    return 'tx-danger';
  }

  // ── Export CSV ───────────────────────────────────────────────────────────────
  exportCsv(): void {
    const items = this.items();
    const period = this.periodLabel();
    const sep = ';';
    const header = [
      'Technicien', 'Région', 'Société',
      'Nb Inter', 'Nb RACC', 'Nb RACC échec', 'Tx RACC échec %',
      'Nb SAV', 'Nb SAV échec', 'Tx SAV échec %',
      'Tx global %'
    ].join(sep);

    const rows = items.map(r => [
      r.technician, r.region, r.societe,
      r.nbTotal, r.nbRacc, r.nbRaccEchec, r.txEchecRacc,
      r.nbSav, r.nbSavEchec, r.txEchecSav,
      r.txEchecGlobal
    ].join(sep));

    const detailHeader = '\nDétail des échecs' + sep + 'N° Inter' + sep +
      'Date' + sep + 'Type' + sep + 'Statut' + sep +
      'Motif échec' + sep + 'Client' + sep + 'Commentaire';

    const detailRows: string[] = [];
    items.forEach(r => {
      r.echecs.forEach(e => {
        detailRows.push([
          r.technician,
          e.numInter,
          e.dateRdv ? this.datePipe.transform(e.dateRdv, 'dd/MM/yyyy') : '',
          e.type, e.statut, e.motifEchec, e.client,
          (e.commentairesTechnicien || '').replace(/;/g, ',')
        ].join(sep));
      });
    });

    const csv = `Audit échecs — ${period}\n\n${header}\n${rows.join('\n')}${detailRows.length ? detailHeader + '\n' + detailRows.join('\n') : ''}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = this.mode() === 'csv'
      ? (this.selectedFile()?.name.replace(/\.csv$/i, '') ?? 'fichier')
      : `${this.filterYear()}-${this.filterMonth()}`;
    a.download = `audit-echecs-${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    return this.datePipe.transform(value, 'dd/MM/yyyy') || '—';
  }

  motifBarWidth(count: number): number {
    const max = this.maxMotifCount();
    return max > 0 ? Math.round((count / max) * 100) : 0;
  }

  echecsOf(item: AuditEchecItem): AuditEchecDetail[] {
    return item.echecs ?? [];
  }

  private resetResults(): void {
    this.items.set([]);
    this.topMotifs.set([]);
    this.totals.set(null);
    this.error.set(null);
    this.expandedRow.set(null);
    this.csvMeta.set(null);
  }
}
