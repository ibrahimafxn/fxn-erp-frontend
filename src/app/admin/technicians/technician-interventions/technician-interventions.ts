import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import {
  InterventionFilters,
  InterventionItem,
  InterventionService,
  InterventionSummaryQuery,
  InterventionTotals
} from '../../../core/services/intervention.service';
import { BpuService } from '../../../core/services/bpu.service';
import { InterventionRates, InterventionRatesService } from '../../../core/services/intervention-rates.service';
import { BpuEntry, User, Role } from '../../../core/models';
import { UserService } from '../../../core/services/user.service';
import { hasRacpavInArticles, isRacihSuccess, isRacpavSuccess } from '../../../core/utils/intervention-prestations';
import { formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

type TechnicianInterventionStats = {
  total: number;
  success: number;
  failure: number;
  cancelled: number;
  avgDuration: number;
  avgFailureDuration: number;
  successRate: number;
  topTechnicians: Array<{ label: string; success: number; failure: number; cancelled: number }>;
  topTypes: Array<{ label: string; count: number }>;
  topStatuses: Array<{ label: string; count: number }>;
};

const EMPTY_STATS: TechnicianInterventionStats = {
  total: 0,
  success: 0,
  failure: 0,
  cancelled: 0,
  avgDuration: 0,
  avgFailureDuration: 0,
  successRate: 0,
  topTechnicians: [],
  topTypes: [],
  topStatuses: []
};

type SortField = 'date' | 'type' | 'statut' | 'duree';
type InterventionDetailField = { key: keyof InterventionItem; label: string };

const TYPE_CANONICAL_ALIASES = new Map([
  // ── Raccordement immeuble (RACIM remplace RACIH) ───────────────────────────
  ['RACIM', 'RACIM'],
  ['RACIH', 'RACIM'],       // rétrocompat anciens imports
  ['RAC_IH', 'RACIM'],      // rétrocompat anciens imports
  // ── Raccordement pavillon ──────────────────────────────────────────────────
  ['RAC_PBO_SOUT', 'RAC_PBO_SOUT'],
  ['RAC_PBO-SOUT', 'RAC_PBO_SOUT'],
  ['RAC_PBO_AERIEN', 'RAC_PBO_AERIEN'],
  ['RAC_PBO_FACADE', 'RAC_PBO_FACADE'],
  ['RACPAV', 'RAC_PBO_SOUT'],  // rétrocompat anciens imports → souterrain par défaut
  ['RAC_PAV', 'RAC_PBO_SOUT'],
  // ── PLV PRO (PLV_PRO_S/C remplacent RACPRO_S/C) ───────────────────────────
  ['PLV_PRO_S', 'PLV_PRO_S'],
  ['RACC PRO S', 'PLV_PRO_S'],
  ['RACC PRO_S', 'PLV_PRO_S'],
  ['RACC PRO-S', 'PLV_PRO_S'],
  ['RACPRO S', 'PLV_PRO_S'],
  ['RACPRO_S', 'PLV_PRO_S'],   // rétrocompat
  ['RACPRO-S', 'PLV_PRO_S'],
  ['PLV_PRO_C', 'PLV_PRO_C'],
  ['RACC PRO C', 'PLV_PRO_C'],
  ['RACC PRO_C', 'PLV_PRO_C'],
  ['RACC PRO-C', 'PLV_PRO_C'],
  ['RACPRO C', 'PLV_PRO_C'],
  ['RACPRO_C', 'PLV_PRO_C'],   // rétrocompat
  ['RACPRO-C', 'PLV_PRO_C'],
  // ── Fourreaux ──────────────────────────────────────────────────────────────
  ['FOURREAU_CASSE_PRIVE', 'FOURREAU_CASSE_PRIVE'],
  ['REPFOU_PRI', 'FOURREAU_CASSE_PRIVE'],   // rétrocompat
  ['REPFOU PRI', 'FOURREAU_CASSE_PRIVE'],
  ['REPFOU-PRI', 'FOURREAU_CASSE_PRIVE'],
  ['FOURREAU_CASSE_BETON', 'FOURREAU_CASSE_BETON'],
  // ── Réfections ────────────────────────────────────────────────────────────
  ['REFRAC', 'REFRAC'],
  ['REFRAC_DEGRADATION', 'REFRAC_DEGRADATION'],
  ['REFC_DGR', 'REFRAC_DEGRADATION'],      // rétrocompat
  // ── Reconnexion / CLEM ────────────────────────────────────────────────────
  ['RECOIP', 'RECOIP'],
  ['RECO IP', 'RECOIP'],
  ['RECO-IP', 'RECOIP'],
  ['RECO', 'RECOIP'],
  ['CLEM', 'CLEM'],
  // ── Déplacements ──────────────────────────────────────────────────────────
  ['DEPLACEMENT_PRISE', 'DEPLACEMENT_PRISE'],
  ['DEPLPRISE', 'DEPLACEMENT_PRISE'],       // rétrocompat
  ['DEPLACEMENT_OFFERT', 'DEPLACEMENT_OFFERT'],
  ['DEPLACEMENT_A_TORT', 'DEPLACEMENT_A_TORT'],
  // ── SAV ───────────────────────────────────────────────────────────────────
  ['SAV', 'SAV'],
  ['SAV_EXP', 'SAV_EXP'],
  // ── Matériel / équipement ─────────────────────────────────────────────────
  ['SWAP_EQUIPEMENT', 'SWAP_EQUIPEMENT'],
  ['BIFIBRE', 'BIFIBRE'],
  ['NACELLE', 'NACELLE'],
  // ── Câble (CABLE_SL remplace CABLE_PAV_1/2/3/4) ───────────────────────────
  ['CABLE_SL', 'CABLE_SL'],
  ['CABLE_PAV_1', 'CABLE_SL'],   // rétrocompat
  ['CABLE_PAV_2', 'CABLE_SL'],
  ['CABLE_PAV_3', 'CABLE_SL'],
  ['CABLE_PAV_4', 'CABLE_SL'],
  // ── Divers ────────────────────────────────────────────────────────────────
  ['PRESTA_COMPL', 'PRESTA_COMPL'],
  ['PRESTA COMPL', 'PRESTA_COMPL'],
  ['DEMO', 'DEMO'],
  // ── Pénalités ─────────────────────────────────────────────────────────────
  ['PEN_SECU_Activigie', 'PEN_SECU_Activigie'],
  ['PEN_SECU_EPI', 'PEN_SECU_EPI'],
  ['PEN_A_Nacelle', 'PEN_A_Nacelle'],
  ['PEN_A_TORT', 'PEN_A_TORT'],
  ['PEN_NON_CLOS', 'PEN_NON_CLOS'],
  ['PEN_NON_HONORE', 'PEN_NON_HONORE'],
  ['PEN_INSTANCE', 'PEN_INSTANCE'],
  ['PEN_RESILIATION', 'PEN_RESILIATION'],
  ['PEN_NCVT', 'PEN_NCVT'],
  ['PEN_RECLAMATION_7j', 'PEN_RECLAMATION_7j'],
  ['PEN_EXPLOITATION', 'PEN_EXPLOITATION'],
  ['PEN_OC', 'PEN_OC'],
  ['SINISTRE', 'SINISTRE'],
  ['PEN_COMPORTEMENT', 'PEN_COMPORTEMENT'],
  // ── Bonus ─────────────────────────────────────────────────────────────────
  ['BONUS_SAV_REPEAT', 'BONUS_SAV_REPEAT'],
  ['BONUS_SAV_REPARATION_VOISIN', 'BONUS_SAV_REPARATION_VOISIN'],
  ['BONUS_SAV_CASSE_VOISIN', 'BONUS_SAV_CASSE_VOISIN'],
  ['BONUS_SAV_B_SUR_P', 'BONUS_SAV_B_SUR_P'],
  ['BONUS_MALUS_RACC', 'BONUS_MALUS_RACC'],
  ['SCORING_TECHNICIEN', 'SCORING_TECHNICIEN'],
]);
const ARTICLE_TYPE_LABELS = [
  // Raccordements
  { label: 'RAC SOUT', marker: 'RAC_PBO_SOUT' },
  { label: 'RAC AERIEN', marker: 'RAC_PBO_AERIEN' },
  { label: 'RAC FACADE', marker: 'RAC_PBO_FACADE' },
  { label: 'RACIM', marker: 'RACIM' },
  // PLV PRO (nouveaux codes STIT)
  { label: 'PLV PRO S', marker: 'PLV_PRO_S' },
  { label: 'PLV PRO C', marker: 'PLV_PRO_C' },
  // Reconnexion / CLEM
  { label: 'RECO', marker: 'RECOIP' },
  { label: 'CLEM', marker: 'CLEM' },
  // SAV
  { label: 'SAV', marker: 'SAV' },
  { label: 'SAV EXP', marker: 'SAV_EXP' },
  // Déplacements
  { label: 'DEPLACEMENT PRISE', marker: 'DEPLACEMENT_PRISE' },
  { label: 'DEPLACEMENT OFFERT', marker: 'DEPLACEMENT_OFFERT' },
  { label: 'DEPLACEMENT A TORT', marker: 'DEPLACEMENT_A_TORT' },
  // Réfections
  { label: 'REFRAC', marker: 'REFRAC' },
  { label: 'REFRAC DEGR', marker: 'REFRAC_DEGRADATION' },
  // Fourreaux
  { label: 'FOURREAU PRIVE', marker: 'FOURREAU_CASSE_PRIVE' },
  { label: 'FOURREAU BETON', marker: 'FOURREAU_CASSE_BETON' },
  // Matériel
  { label: 'SWAP', marker: 'SWAP_EQUIPEMENT' },
  { label: 'BIFIBRE', marker: 'BIFIBRE' },
  { label: 'NACELLE', marker: 'NACELLE' },
  // Câble
  { label: 'CABLE SL', marker: 'CABLE_SL' },
  // Divers
  { label: 'PRESTA COMPL', marker: 'PRESTA_COMPL' },
  { label: 'DEMO', marker: 'DEMO' },
  // Pénalités
  { label: 'PEN SECU ACTIVIGIE', marker: 'PEN_SECU_Activigie' },
  { label: 'PEN SECU EPI', marker: 'PEN_SECU_EPI' },
  { label: 'PEN NACELLE', marker: 'PEN_A_Nacelle' },
  { label: 'PEN A TORT', marker: 'PEN_A_TORT' },
  { label: 'PEN NON CLOS', marker: 'PEN_NON_CLOS' },
  { label: 'PEN NON HONORE', marker: 'PEN_NON_HONORE' },
  { label: 'PEN INSTANCE', marker: 'PEN_INSTANCE' },
  { label: 'PEN RESILIATION', marker: 'PEN_RESILIATION' },
  { label: 'PEN NCVT', marker: 'PEN_NCVT' },
  { label: 'PEN RECLAMATION 7J', marker: 'PEN_RECLAMATION_7j' },
  { label: 'PEN EXPLOITATION', marker: 'PEN_EXPLOITATION' },
  { label: 'PEN OC', marker: 'PEN_OC' },
  { label: 'SINISTRE', marker: 'SINISTRE' },
  { label: 'PEN COMPORTEMENT', marker: 'PEN_COMPORTEMENT' },
  // Bonus
  { label: 'BONUS SAV REPEAT', marker: 'BONUS_SAV_REPEAT' },
  { label: 'BONUS SAV REP VOISIN', marker: 'BONUS_SAV_REPARATION_VOISIN' },
  { label: 'BONUS SAV CASSE VOISIN', marker: 'BONUS_SAV_CASSE_VOISIN' },
  { label: 'BONUS SAV B/P', marker: 'BONUS_SAV_B_SUR_P' },
  { label: 'BONUS MALUS RACC', marker: 'BONUS_MALUS_RACC' },
  { label: 'SCORING TECH', marker: 'SCORING_TECHNICIEN' },
];
const ARTICLE_TYPE_BY_CODE = new Map([
  // Raccordements
  ['RAC_PBO_SOUT', 'RAC SOUT'],
  ['RAC_PBO_AERIEN', 'RAC AERIEN'],
  ['RAC_PBO_FACADE', 'RAC FACADE'],
  ['RACIM', 'RACIM'],
  ['RACIH', 'RACIM'],                    // rétrocompat
  ['RACPAV', 'RAC SOUT'],               // rétrocompat
  // PLV PRO
  ['PLV_PRO_S', 'PLV PRO S'],
  ['PLV_PRO_C', 'PLV PRO C'],
  ['RACPRO_S', 'PLV PRO S'],            // rétrocompat
  ['RACPRO_C', 'PLV PRO C'],            // rétrocompat
  // Reconnexion / CLEM
  ['RECOIP', 'RECO'],
  ['CLEM', 'CLEM'],
  // SAV
  ['SAV', 'SAV'],
  ['SAV_EXP', 'SAV EXP'],
  // Déplacements
  ['DEPLACEMENT_PRISE', 'DEPLACEMENT PRISE'],
  ['DEPLPRISE', 'DEPLACEMENT PRISE'],   // rétrocompat
  ['DEPLACEMENT_OFFERT', 'DEPLACEMENT OFFERT'],
  ['DEPLACEMENT_A_TORT', 'DEPLACEMENT A TORT'],
  // Réfections
  ['REFRAC', 'REFRAC'],
  ['REFRAC_DEGRADATION', 'REFRAC DEGR'],
  ['REFC_DGR', 'REFRAC DEGR'],          // rétrocompat
  // Fourreaux
  ['FOURREAU_CASSE_PRIVE', 'FOURREAU PRIVE'],
  ['REPFOU_PRI', 'FOURREAU PRIVE'],     // rétrocompat
  ['FOURREAU_CASSE_BETON', 'FOURREAU BETON'],
  // Matériel
  ['SWAP_EQUIPEMENT', 'SWAP'],
  ['BIFIBRE', 'BIFIBRE'],
  ['NACELLE', 'NACELLE'],
  // Câble
  ['CABLE_SL', 'CABLE SL'],
  ['CABLE_PAV_1', 'CABLE SL'],          // rétrocompat
  ['CABLE_PAV_2', 'CABLE SL'],
  ['CABLE_PAV_3', 'CABLE SL'],
  ['CABLE_PAV_4', 'CABLE SL'],
  // Divers
  ['PRESTA_COMPL', 'PRESTA COMPL'],
  ['DEMO', 'DEMO'],
  // Pénalités
  ['PEN_SECU_Activigie', 'PEN SECU ACTIVIGIE'],
  ['PEN_SECU_EPI', 'PEN SECU EPI'],
  ['PEN_A_Nacelle', 'PEN NACELLE'],
  ['PEN_A_TORT', 'PEN A TORT'],
  ['PEN_NON_CLOS', 'PEN NON CLOS'],
  ['PEN_NON_HONORE', 'PEN NON HONORE'],
  ['PEN_INSTANCE', 'PEN INSTANCE'],
  ['PEN_RESILIATION', 'PEN RESILIATION'],
  ['PEN_NCVT', 'PEN NCVT'],
  ['PEN_RECLAMATION_7j', 'PEN RECLAMATION 7J'],
  ['PEN_EXPLOITATION', 'PEN EXPLOITATION'],
  ['PEN_OC', 'PEN OC'],
  ['SINISTRE', 'SINISTRE'],
  ['PEN_COMPORTEMENT', 'PEN COMPORTEMENT'],
  // Bonus
  ['BONUS_SAV_REPEAT', 'BONUS SAV REPEAT'],
  ['BONUS_SAV_REPARATION_VOISIN', 'BONUS SAV REP VOISIN'],
  ['BONUS_SAV_CASSE_VOISIN', 'BONUS SAV CASSE VOISIN'],
  ['BONUS_SAV_B_SUR_P', 'BONUS SAV B/P'],
  ['BONUS_MALUS_RACC', 'BONUS MALUS RACC'],
  ['SCORING_TECHNICIEN', 'SCORING TECH'],
]);
const REQUIRED_TYPE_LABELS = ['RECOIP'];

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-technician-interventions',
  templateUrl: './technician-interventions.html',
  styleUrls: ['./technician-interventions.scss']
})
export class TechnicianInterventions {
  private svc = inject(InterventionService);
  private bpuService = inject(BpuService);
  private ratesService = inject(InterventionRatesService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  readonly filterLoading = signal(false);
  readonly filtersError = signal<string | null>(null);
  readonly filters = signal<InterventionFilters | null>(null);
  readonly technicians = signal<User[]>([]);
  readonly summaryLoading = signal(false);
  readonly summaryTotals = signal<InterventionTotals | null>(null);
  readonly bpuCodes = signal<Set<string>>(new Set());
  readonly bpuAutoEntries = signal<BpuEntry[]>([]);
  readonly bpuLoading = signal(false);
  readonly bpuError = signal<string | null>(null);

  readonly tableLoading = signal(false);
  readonly tableError = signal<string | null>(null);
  readonly interventions = signal<InterventionItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly detailOpen = signal(false);
  readonly selectedDetail = signal<InterventionItem | null>(null);
  readonly initialLoading = signal(true);

  private readonly detailFields: InterventionDetailField[] = [
    { key: '_id', label: 'ID' },
    { key: 'numInter', label: 'Numero' },
    { key: 'dateRdv', label: 'Date RDV' },
    { key: 'region', label: 'Region' },
    { key: 'plaque', label: 'Plaque' },
    { key: 'societe', label: 'Societe' },
    { key: 'techFirstName', label: 'Technicien prenom' },
    { key: 'techLastName', label: 'Technicien nom' },
    { key: 'techFull', label: 'Technicien' },
    { key: 'type', label: 'Type' },
    { key: 'client', label: 'Client' },
    { key: 'statut', label: 'Statut' },
    { key: 'commentairesTechnicien', label: 'Commentaires technicien' },
    { key: 'debut', label: 'Debut' },
    { key: 'duree', label: 'Duree' },
    { key: 'clotureHotline', label: 'Cloture hotline' },
    { key: 'clotureTech', label: 'Cloture tech' },
    { key: 'debutIntervention', label: 'Debut intervention' },
    { key: 'creneauPlus2h', label: 'Creneau +2h' },
    { key: 'motifEchec', label: 'Motif echec' },
    { key: 'ville', label: 'Ville' },
    { key: 'typeLogement', label: 'Type logement' },
    { key: 'actionSav', label: 'Action SAV' },
    { key: 'longueurCable', label: 'Longueur cable' },
    { key: 'typePbo', label: 'Type PBO' },
    { key: 'typeOperation', label: 'Type operation' },
    { key: 'typeHabitation', label: 'Type habitation' },
    { key: 'priseExistante', label: 'Prise existante' },
    { key: 'recoRacc', label: 'Reco/Racc' },
    { key: 'marque', label: 'Marque' },
    { key: 'listePrestationsRaw', label: 'Liste prestations' },
    { key: 'articlesRaw', label: 'Articles' },
    { key: 'categories', label: 'Categories' },
    { key: 'isSuccess', label: 'Succes' },
    { key: 'isFailure', label: 'Echec' },
    { key: 'versionIndex', label: 'Version' },
    { key: 'latestVersionId', label: 'Derniere version ID' },
    { key: 'importedAt', label: 'Importe le' }
  ];

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly pageRange = formatPageRange;
  readonly limitOptions = [10, 20, 50, 100];
  readonly isBusy = computed(() => this.filterLoading() || this.summaryLoading() || this.tableLoading());

  readonly filterForm = this.fb.nonNullable.group({
    technician: this.fb.nonNullable.control(''),
    region: this.fb.nonNullable.control(''),
    client: this.fb.nonNullable.control(''),
    numInter: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control(''),
    type: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly statsDataset = signal<InterventionItem[]>([]);
  readonly stats = computed(() => this.computeStats(this.statsDataset(), this.total(), this.filterForm.controls.type.value));
  readonly failurePercent = computed(() => this.computeFailurePercent(this.stats()));
  readonly successRateBg = computed(() => this.computeSuccessRateBg(this.stats().successRate));
  readonly reconnectionCount = computed(() => this.countMatchingType('RECOIP'));
  readonly sortField = signal<SortField>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly sortedInterventions = computed(() => this.sortedItems());
  readonly typeOptions = computed(() => {
    const types = this.filters()?.types ?? [];
    const mapped = types.map((value) => (value === 'RACC' ? 'RACPAV' : value));
    if (!mapped.includes('RACIH')) {
      mapped.push('RACIH');
    }
    return mapped;
  });
  constructor() {
    this.loadFilters();
    this.loadTechnicians();
    this.loadInterventions();
    this.loadSummary();
    this.loadAutoBpu();
    this.ratesService.refresh().subscribe();
  }

  applyFilters(): void {
    this.page.set(1);
    this.ratesService.refresh().subscribe();
    this.loadInterventions();
    this.loadSummary();
  }

  clearFilters(): void {
    this.filterForm.reset({
      technician: '',
      region: '',
      client: '',
      numInter: '',
      status: '',
      type: '',
      fromDate: '',
      toDate: ''
    });
    this.page.set(1);
    this.ratesService.refresh().subscribe();
    this.loadInterventions();
    this.loadSummary();
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.update((value) => value - 1);
    this.loadInterventions();
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.update((value) => value + 1);
    this.loadInterventions();
  }

  setLimit(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.loadInterventions();
  }

  refresh(): void {
    this.clearFilters();
  }

  exportCsv(): void {
    const query = this.buildQuery({ includePagination: false });
    this.svc.exportCsv(query).subscribe({
      next: (blob) => this.downloadBlob(blob, 'interventions-export.csv'),
      error: () => this.tableError.set('Erreur export CSV')
    });
  }

  exportPdf(): void {
    const query = this.buildQuery({ includePagination: false });
    this.svc.exportPdf(query).subscribe({
      next: (blob) => this.downloadBlob(blob, 'interventions-export.pdf'),
      error: () => this.tableError.set('Erreur export PDF')
    });
  }

  saveView(): void {
    this.tableError.set('Sauvegarde de vue à venir.');
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortField.set(field);
    this.sortDirection.set(field === 'date' ? 'desc' : 'asc');
  }

  sortArrow(field: SortField): string {
    if (this.sortField() !== field) return '';
    return this.sortDirection() === 'asc' ? '▲' : '▼';
  }

  private loadFilters(): void {
    this.filterLoading.set(true);
    this.filtersError.set(null);
    this.svc.filters().subscribe({
      next: (res) => {
        this.filterLoading.set(false);
        if (res?.success) {
          this.filters.set(this.ensureCablePavTypes(res.data));
          this.markInitialLoadComplete();
          return;
        }
        this.filtersError.set('Impossible de charger les filtres des interventions.');
        this.markInitialLoadComplete();
      },
      error: (err) => {
        this.filterLoading.set(false);
        this.filtersError.set(this.apiError(err, 'Impossible de charger les filtres des interventions.'));
        this.markInitialLoadComplete();
      }
    });
  }

  private loadAutoBpu(): void {
    this.bpuLoading.set(true);
    this.bpuError.set(null);
    this.bpuService.list('AUTO').subscribe({
      next: (items) => {
        this.bpuAutoEntries.set(items || []);
        const codes = new Set(
          (items || [])
            .map((entry) => this.normalizeToken(entry.code).replace(/[^A-Z0-9_]/g, ''))
            .filter(Boolean)
        );
        this.bpuCodes.set(codes);
        this.bpuLoading.set(false);
      },
      error: (err) => {
        this.bpuLoading.set(false);
        this.bpuError.set(this.apiError(err, 'Erreur chargement BPU AUTO'));
      }
    });
  }

  private ensureCablePavTypes(filters: InterventionFilters): InterventionFilters {
    const extra = [
      'CABLE_PAV_1',
      'CABLE_PAV_2',
      'CABLE_PAV_3',
      'CABLE_PAV_4',
      'CLEM',
      'RACPRO_S',
      'RACPRO_C'
    ];
    const types = Array.isArray(filters?.types) ? [...filters.types] : [];
    for (const entry of extra) {
      if (!types.includes(entry)) {
        types.push(entry);
      }
    }
    types.sort((a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' }));
    return { ...filters, types };
  }

  private loadTechnicians(): void {
    this.userService.refreshUsers(true, { page: 1, limit: 500, role: Role.TECHNICIEN }).subscribe({
      next: (res) => this.technicians.set(res.items ?? []),
      error: () => this.technicians.set([])
    });
  }

  private loadInterventions(): void {
    this.tableLoading.set(true);
    this.tableError.set(null);
    const pagedQuery = this.buildQuery({ includePagination: true });
    this.svc.list(pagedQuery).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.tableError.set('Impossible de charger les interventions.');
          this.tableLoading.set(false);
          return;
        }
        const items = res.data.items || [];
        const exactEchec = this.isExactEchecFilterActive();
        const strictRacpav = this.isStrictRacpavFilterActive();
        const strictSav = this.isStrictSavFilterActive();
        const listFilteredItems = this.applyStrictListFilters(items);
        const totalFromRes = res.data.total || 0;

        if ((exactEchec || strictRacpav || strictSav) && totalFromRes > items.length) {
          const fullQuery = this.buildQuery({ includePagination: false });
          fullQuery.page = 1;
          fullQuery.limit = totalFromRes;
          this.svc.list(fullQuery).subscribe({
            next: (fullRes) => {
              if (!fullRes?.success) {
                this.tableError.set('Impossible de charger les interventions.');
                this.tableLoading.set(false);
                return;
              }
              const incoming = fullRes.data.items || [];
              const fullListItems = this.applyStrictListFilters(incoming);
              const fullStatsItems = this.applyStrictStatsFilters(incoming);
              const total = fullListItems.length;
              const page = this.page();
              const limit = this.limit();
              const start = (page - 1) * limit;
              const pagedItems = fullListItems.slice(start, start + limit);
              this.interventions.set(pagedItems);
              this.total.set(total);
              this.statsDataset.set(fullStatsItems);
              this.tableLoading.set(false);
              this.markInitialLoadComplete();
            },
            error: (err) => {
              this.tableLoading.set(false);
              this.tableError.set(this.apiError(err, 'Impossible de charger les interventions.'));
              this.markInitialLoadComplete();
            }
          });
          return;
        }

        const total = (exactEchec || strictRacpav || strictSav) ? listFilteredItems.length : totalFromRes;
        const statsSource = (exactEchec || strictRacpav || strictSav) ? items : listFilteredItems;
        this.interventions.set(listFilteredItems);
        this.total.set(total);
        this.updateStatsDataset(statsSource, total, pagedQuery);
        this.tableLoading.set(false);
        this.markInitialLoadComplete();
      },
      error: (err) => {
        this.tableLoading.set(false);
        this.tableError.set(this.apiError(err, 'Impossible de charger les interventions.'));
        this.markInitialLoadComplete();
      }
    });
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    const query = this.buildQuery({ includePagination: false });
    this.svc.summary(query).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.summaryTotals.set(null);
          this.summaryLoading.set(false);
          this.markInitialLoadComplete();
          return;
        }
        this.summaryTotals.set(res.data.totals || null);
        this.summaryLoading.set(false);
        this.markInitialLoadComplete();
      },
      error: () => {
        this.summaryTotals.set(null);
        this.summaryLoading.set(false);
        this.markInitialLoadComplete();
      }
    });
  }

  private markInitialLoadComplete(): void {
    if (!this.initialLoading()) return;
    if (!this.filterLoading() && !this.summaryLoading() && !this.tableLoading()) {
      this.initialLoading.set(false);
    }
  }

  private buildQuery(options?: { includePagination?: boolean }): InterventionSummaryQuery {
    const filters = this.filterForm.getRawValue();
    const range = this.normalizeDateRange(filters.fromDate, filters.toDate);
    const rawType = filters.type || '';
    const normalizedType = this.normalizeToken(rawType);
    const typeFilter = rawType === 'RACPAV' ? undefined : rawType;
    const statusFilter = normalizedType === 'ECHEC' ? 'ECHEC' : filters.status;
    return {
      technician: filters.technician || undefined,
      region: filters.region || undefined,
      client: filters.client || undefined,
      numInter: filters.numInter || undefined,
      status: statusFilter || undefined,
      type: normalizedType === 'ECHEC' ? undefined : (typeFilter || undefined),
      ...range,
      ...(options?.includePagination ?? true
        ? { page: this.page(), limit: this.limit() }
        : {})
    };
  }

  private normalizeDateRange(from: string, to: string): { fromDate?: string; toDate?: string } {
    const fromDate = from?.trim() || '';
    const toDate = to?.trim() || '';
    return {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined
    };
  }

  private isExactEchecFilterActive(): boolean {
    const rawFilters = this.filterForm.getRawValue();
    const rawType = rawFilters.type || '';
    const rawStatus = rawFilters.status || '';
    return this.normalizeToken(rawType) === 'ECHEC' || this.normalizeToken(rawStatus) === 'ECHEC';
  }

  private isExactEchecStatus(status?: string | null): boolean {
    const normalized = this.normalizeToken(status);
    return normalized.includes('ECHEC') && !normalized.includes('TERMINE');
  }

  private isStrictRacpavFilterActive(): boolean {
    const rawType = this.filterForm.getRawValue().type || '';
    return this.normalizeToken(rawType) === 'RACPAV';
  }

  private isStrictSavFilterActive(): boolean {
    const rawType = this.filterForm.getRawValue().type || '';
    return this.normalizeToken(rawType) === 'SAV';
  }

  private isStrictPrestaComplFilterActive(): boolean {
    const rawType = this.filterForm.getRawValue().type || '';
    return this.normalizeToken(rawType) === 'PRESTA_COMPL';
  }

  private isPavillonHousing(value?: string | null): boolean {
    const normalized = this.normalizeToken(value);
    return normalized.includes('PAVILLON') || normalized === 'PAV';
  }

  private isRacpavType(value?: string | null): boolean {
    const normalized = this.normalizeToken(value);
    return normalized === 'RACC' || normalized === 'RACPAV';
  }

  private applyStrictListFilters(items: InterventionItem[]): InterventionItem[] {
    const exactEchec = this.isExactEchecFilterActive();
    const strictRacpav = this.isStrictRacpavFilterActive();
    const strictSav = this.isStrictSavFilterActive();
    if (!exactEchec && !strictRacpav && !strictSav) return items;
    return items.filter((item) => {
      if (exactEchec && !this.isExactEchecStatus(item.statut)) return false;
      if (strictRacpav) {
        const status = this.normalizeToken(item.statut);
        const isEchecTermine = status.includes('ECHEC') && status.includes('TERMINE');
        const isExactEchec = status.includes('ECHEC') && !status.includes('TERMINE');
        const isCancelled = status.includes('ANNULE');
        const isPavillon = this.isPavillonHousing(item.typeLogement);
        const isRacpavRelated = this.isRacpavType(item.type) || hasRacpavInArticles(item.articlesRaw);
        const isFailureOrCancel = isPavillon && isRacpavRelated && (isExactEchec || isEchecTermine || isCancelled);
        if (!isRacpavSuccess(item.statut, item.articlesRaw) && !isFailureOrCancel) return false;
      }
      if (strictSav && !this.isExactSavItem(item)) return false;
      return true;
    });
  }

  private applyStrictStatsFilters(items: InterventionItem[]): InterventionItem[] {
    const exactEchec = this.isExactEchecFilterActive();
    const strictRacpav = this.isStrictRacpavFilterActive();
    const strictSav = this.isStrictSavFilterActive();
    if (!exactEchec && !strictRacpav && !strictSav) return items;
    return items.filter((item) => {
      if (exactEchec && !this.isExactEchecStatus(item.statut)) return false;
      if (strictRacpav) {
        const status = this.normalizeToken(item.statut);
        const isEchecTermine = status.includes('ECHEC') && status.includes('TERMINE');
        const isExactEchec = status.includes('ECHEC') && !status.includes('TERMINE');
        const isCancelled = status.includes('ANNULE');
        const isPavillon = this.isPavillonHousing(item.typeLogement);
        const isRacpavRelated = this.isRacpavType(item.type) || hasRacpavInArticles(item.articlesRaw);
        const isFailureOrCancel = isPavillon && isRacpavRelated && (isExactEchec || isEchecTermine || isCancelled);
        if (!hasRacpavInArticles(item.articlesRaw) && !isFailureOrCancel) return false;
      }
      if (strictSav && !this.isExactSavItem(item)) return false;
      return true;
    });
  }

  private isExactSavItem(item: InterventionItem): boolean {
    const typeNormalized = this.normalizeToken(item.type);
    return typeNormalized === 'SAV';
  }

  private hasExactSavCode(value?: string | null): boolean {
    if (!value) return false;
    return this.extractCodeTokens(value).includes('SAV');
  }

  private isPrestaComplItem(item: InterventionItem): boolean {
    const typeNormalized = this.normalizeToken(item.type).replace(/-/g, ' ').trim();
    if (typeNormalized === 'PRESTA COMPL') return true;
    return (
      this.hasCode(item.articlesRaw, 'PRESTA_COMPL')
      || this.hasCode(item.articlesRaw, 'PRESTA_COMP')
      || this.hasCode(item.listePrestationsRaw, 'PRESTA_COMPL')
      || this.hasCode(item.listePrestationsRaw, 'PRESTA_COMP')
    );
  }

  private countClosedByType(type: string): number {
    const items = this.statsDataset();
    if (!items.length) return 0;
    return items.reduce((acc, item) => {
      const matches = this.resolveSuccessPrestations(item);
      return matches.includes(type) ? acc + 1 : acc;
    }, 0);
  }

  private rateForType(type: string, rates: InterventionRates): number {
    const map: Record<string, number> = {
      // Raccordements pavillon
      RAC_PBO_SOUT: rates.racPavillon.total,
      RAC_PBO_AERIEN: rates.racAerien.total,
      RAC_PBO_FACADE: rates.racFacade.total,
      RACPAV: rates.racPavillon.total,         // rétrocompat
      // Raccordement immeuble
      RACIM: rates.racImmeuble.total,
      RACIH: rates.racImmeuble.total,           // rétrocompat
      // PLV PRO
      PLV_PRO_S: rates.racProS.total,
      PLV_PRO_C: rates.racProC.total,
      RACPRO_S: rates.racProS.total,            // rétrocompat
      RACPRO_C: rates.racProC.total,            // rétrocompat
      // Reconnexion / CLEM
      RECOIP: rates.reconnexion.total,
      CLEM: rates.clem.total,
      // Fourreaux
      FOURREAU_CASSE_PRIVE: rates.racF8.total,
      REPFOU_PRI: rates.racF8.total,            // rétrocompat
      FOURREAU_CASSE_BETON: rates.fourreauBeton.total,
      // Réfections
      REFRAC: rates.refrac.total,
      REFRAC_DEGRADATION: rates.refcDgr.total,
      REFC_DGR: rates.refcDgr.total,            // rétrocompat
      // Déplacements
      DEPLACEMENT_PRISE: rates.deplacementPrise.total,
      DEPLPRISE: rates.deplacementPrise.total,  // rétrocompat
      DEPLACEMENT_OFFERT: rates.deplacementOffert.total,
      DEPLACEMENT_A_TORT: rates.deplacementATort.total,
      // SAV
      SAV: rates.sav.total,
      SAV_EXP: rates.savExp.total,
      // Matériel
      SWAP_EQUIPEMENT: rates.swapEquipement.total,
      BIFIBRE: rates.bifibre.total,
      NACELLE: rates.nacelle.total,
      // Câble
      CABLE_SL: rates.cableSl.total,
      CABLE_PAV_1: rates.cableSl.total,         // rétrocompat
      CABLE_PAV_2: rates.cableSl.total,
      CABLE_PAV_3: rates.cableSl.total,
      CABLE_PAV_4: rates.cableSl.total,
      // Divers
      PRESTA_COMPL: rates.prestaCompl.total,
      DEMO: rates.demo.total,
    };
    return map[type] ?? 0;
  }

  private logAmountBreakdown(rates: InterventionRates): void {
    const totals = this.summaryTotals();
    if (!totals) return;
    const rows: Array<{ key: string; qty: number; unit: number; total: number }> = [];
    const push = (key: string, qty: number | undefined, unit: number) => {
      const count = Number(qty || 0);
      if (!count) return;
      rows.push({ key, qty: count, unit, total: Math.round(count * unit * 100) / 100 });
    };

    push('RAC_PBO_SOUT', totals.racPavillon, rates.racPavillon.total);
    push('RAC_PBO_AERIEN', totals.racAerien, rates.racAerien.total);
    push('RAC_PBO_FACADE', totals.racFacade, rates.racFacade.total);
    push('RACIM', totals.racImmeuble, rates.racImmeuble.total);
    push('PLV_PRO_S', totals.racProS, rates.racProS.total);
    push('PLV_PRO_C', totals.racProC, rates.racProC.total);
    push('RECOIP', totals.reconnexion, rates.reconnexion.total);
    push('CLEM', totals.clem, rates.clem.total);
    push('FOURREAU_CASSE_PRIVE', totals.racF8, rates.racF8.total);
    push('FOURREAU_CASSE_BETON', totals.fourreauBeton, rates.fourreauBeton.total);
    push('PRESTA_COMPL', totals.prestaCompl, rates.prestaCompl.total);
    push('DEPLACEMENT_PRISE', totals.deplacementPrise, rates.deplacementPrise.total);
    push('DEPLACEMENT_OFFERT', totals.deplacementOffert, rates.deplacementOffert.total);
    push('DEPLACEMENT_A_TORT', totals.deplacementATort, rates.deplacementATort.total);
    push('DEMO', totals.demo, rates.demo.total);
    push('SAV', totals.sav, rates.sav.total);
    push('SAV_EXP', totals.savExp, rates.savExp.total);
    push('SWAP_EQUIPEMENT', totals.swapEquipement, rates.swapEquipement.total);
    push('BIFIBRE', totals.bifibre, rates.bifibre.total);
    push('NACELLE', totals.nacelle, rates.nacelle.total);
    push('REFRAC', totals.refrac, rates.refrac.total);
    push('REFRAC_DEGRADATION', totals.refcDgr, rates.refcDgr.total);
    push('CABLE_SL', totals.cableSl, rates.cableSl.total);

    if (!rows.length) return;
    const sum = rows.reduce((acc, row) => acc + row.total, 0);
    console.groupCollapsed('[FXN] Montant total - détail prestations');
    console.table(rows);
    console.groupEnd();
  }

  private computeStats(items: InterventionItem[], totalCount: number, filterType?: string): TechnicianInterventionStats {
    const total = Number.isFinite(totalCount) && totalCount >= 0 ? totalCount : items.length;
    if (!items.length) return { ...EMPTY_STATS, total };
    const allowedType = this.normalizeFilterType(filterType);
    const allowedTypeLabel = allowedType ? this.normalizeTypeLabel(allowedType) : '';
    const enforcedTypeLabels = allowedType ? [allowedType] : REQUIRED_TYPE_LABELS;
    let success = 0;
    let failure = 0;
    let cancelled = 0;
    let durationSum = 0;
    let durationCount = 0;
    let failureDurationSum = 0;
    let failureDurationCount = 0;
    const technicians = new Map<string, { success: number; failure: number; cancelled: number }>();
    const types = new Map<string, number>();
    const statuses = new Map<string, number>();
    const articleTypeCounts = new Map<string, number>(
      ARTICLE_TYPE_LABELS.map(({ label }) => [label, 0])
    );

    const missingTypeRows: Array<{
      numInter?: string;
      statut?: string;
      type?: string;
      articlesRaw?: string;
      listePrestationsRaw?: string;
      typeOperation?: string;
      commentairesTechnicien?: string;
    }> = [];
    const dominantDebugRows: Array<{
      numInter?: string;
      statut?: string;
      type?: string;
      typeOperation?: string;
      typeLogement?: string;
      marque?: string;
      articlesRaw?: string;
      commentairesTechnicien?: string;
      dominantTypes?: string;
      dominantInArticles?: boolean;
    }> = [];

    for (const item of items) {
      const statutRaw = item.statut ?? '';
      const statut = statutRaw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const isCancelledStatus = statut.includes('annul');
      const isEchecTermine = statut.includes('echec') && statut.includes('termine');
      const isExactEchec = statut.includes('echec') && !statut.includes('termine');
      const isFailureStatus = isEchecTermine || statut.includes('echec') || statut.includes('fail');
      const isClosed = this.isClosedTerminated(statutRaw);
      let isCancelled = isCancelledStatus;
      let isFailure = isFailureStatus;
      let isSuccess = isClosed && !isFailure && !isCancelled && !isEchecTermine;

      if (allowedType === 'RACPAV') {
        const isPavillon = this.isPavillonHousing(item.typeLogement);
        isFailure = isPavillon && (isExactEchec || isEchecTermine);
        isCancelled = isPavillon && isCancelledStatus;
        isSuccess = isRacpavSuccess(item.statut, item.articlesRaw);
      }
      if (isFailure) {
        failure++;
      } else if (isCancelled) {
        cancelled++;
      } else if (isSuccess) {
        success++;
      }
      const dominantTypes = this.resolveDominantTypes(item);
      const dominantInArticles = dominantTypes.length
        ? dominantTypes.every((code) => this.hasCode(item.articlesRaw, code))
        : false;
      const typeLabel = this.canonicalType(item.type, item);
      const matchesAllowedType = !allowedType
        || dominantTypes.includes(allowedType)
        || this.matchesAllowedType(typeLabel, allowedType);
      const includeInTop = isClosed || isFailure || isCancelled;
      if (matchesAllowedType && includeInTop) {
        const techLabel = this.formatTechnicianName(item);
        const techStats = technicians.get(techLabel) ?? { success: 0, failure: 0, cancelled: 0 };
        if (isCancelled) {
          techStats.cancelled = (techStats.cancelled || 0) + 1;
        } else if (isFailure) {
          techStats.failure = (techStats.failure || 0) + 1;
        } else if (isSuccess) {
          techStats.success = (techStats.success || 0) + 1;
        }
        technicians.set(techLabel, techStats);
      }
      const isCompleted = statut.includes('termine') || statut.includes('cloture') || isEchecTermine;
      const value = isCompleted ? this.computeDuration(item) : 0;
      if (Number.isFinite(value) && value > 0 && !isCancelled && !isFailure) {
        durationSum += value;
        durationCount++;
      }
      const failureValue = isFailure ? this.computeFailureDuration(item) : 0;
      if (Number.isFinite(failureValue) && failureValue > 0 && !isCancelled) {
        failureDurationSum += failureValue;
        failureDurationCount++;
      }
      if (isClosed) {
        dominantDebugRows.push({
          numInter: item.numInter,
          statut: item.statut,
          type: item.type,
          typeOperation: item.typeOperation,
          typeLogement: item.typeLogement,
          marque: item.marque,
          articlesRaw: item.articlesRaw,
          commentairesTechnicien: item.commentairesTechnicien,
          dominantTypes: dominantTypes.join(','),
          dominantInArticles
        });
        if (allowedType) {
          if (dominantTypes.includes(allowedType)) {
            types.set(allowedType, (types.get(allowedType) ?? 0) + 1);
          }
        } else if (dominantTypes.length) {
          for (const label of dominantTypes) {
            types.set(label, (types.get(label) ?? 0) + 1);
          }
        } else {
          const typeLabel = this.canonicalType(item.type, item);
          types.set(typeLabel, (types.get(typeLabel) ?? 0) + 1);
          if (typeLabel === '—' || typeLabel === 'OTHER' || !typeLabel) {
            missingTypeRows.push({
              numInter: item.numInter,
              statut: item.statut,
              type: item.type,
              articlesRaw: item.articlesRaw,
              listePrestationsRaw: item.listePrestationsRaw,
              typeOperation: item.typeOperation,
              commentairesTechnicien: item.commentairesTechnicien
            });
          }
        }
      }
      const rawStatusLabel = item.statut?.trim() || 'Autre';
      const normalizedStatus = this.normalizeToken(rawStatusLabel);
      let statusLabel = rawStatusLabel;
      if (normalizedStatus.includes('ECHEC') && normalizedStatus.includes('TERMINE')) {
        statusLabel = 'ECHEC TERMINE';
      } else if (normalizedStatus.includes('ECHEC')) {
        statusLabel = 'ECHEC';
      } else if (normalizedStatus.includes('ANNULEE') || normalizedStatus.includes('ANNULE')) {
        statusLabel = 'ANNULEE';
      }
      if (!allowedType) {
        statuses.set(statusLabel, (statuses.get(statusLabel) ?? 0) + 1);
      } else {
        const typeLabel = this.canonicalType(item.type, item);
        const matchesAllowedType = dominantTypes.includes(allowedType) || this.matchesAllowedType(typeLabel, allowedType);
        if ((isClosed && matchesAllowedType) || (isCancelled && matchesAllowedType) || (isFailure && matchesAllowedType)) {
          statuses.set(statusLabel, (statuses.get(statusLabel) ?? 0) + 1);
        }
      }
      if (isClosed) {
        const articleLabels = new Set<string>();
        for (const code of dominantTypes) {
          const label = ARTICLE_TYPE_BY_CODE.get(code);
          if (!label) continue;
          if (allowedType && !this.isAllowedArticleLabel(label, allowedTypeLabel)) {
            continue;
          }
          articleTypeCounts.set(label, (articleTypeCounts.get(label) ?? 0) + 1);
          articleLabels.add(label);
        }
        if (!articleLabels.size) {
          const typeLabel = this.canonicalType(item.type, item);
          const label = ARTICLE_TYPE_BY_CODE.get(typeLabel);
          if (label && (!allowedType || this.isAllowedArticleLabel(label, allowedTypeLabel))) {
            articleTypeCounts.set(label, (articleTypeCounts.get(label) ?? 0) + 1);
          }
        }
      }
    }

    const topTechnicians = Array.from(technicians.entries())
      .map(([label, stats]) => ({
        label,
        success: stats.success,
        failure: stats.failure,
        cancelled: stats.cancelled,
        ratio: (stats.failure + stats.cancelled) === 0
          ? (stats.success === 0 ? 0 : Infinity)
          : stats.success / (stats.failure + stats.cancelled)
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 3)
      .map(({ label, success, failure, cancelled }) => ({ label, success, failure, cancelled }));
    const baseTopTypes = Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
    const displayBaseTopTypes = baseTopTypes.map((type) => ({
      label: this.labelToBpuCode(type.label),
      count: type.count
    }));
    const baseTypeLabels = new Set(displayBaseTopTypes.map((type) => type.label));
    const enforcedTypes = enforcedTypeLabels
      .filter((label) => !baseTopTypes.some((type) => type.label === label))
      .map((label) => ({ label, count: types.get(label) ?? 0 }));
    const articleTypeEntries = ARTICLE_TYPE_LABELS.map(({ label }) => ({
      label: this.labelToBpuCode(label),
      count: articleTypeCounts.get(label) ?? 0
    })).filter((entry) => !baseTypeLabels.has(entry.label));
    const enforcedTypeEntries = enforcedTypes
      .map((entry) => ({
        label: this.labelToBpuCode(entry.label),
        count: entry.count
      }))
      .filter((entry) => !baseTypeLabels.has(entry.label));
    const topTypes = [...displayBaseTopTypes, ...articleTypeEntries, ...enforcedTypeEntries];
    const uniqueTopTypes: Array<{ label: string; count: number }> = [];
    for (const entry of topTypes) {
      const existing = uniqueTopTypes.find((item) => item.label === entry.label);
      if (existing) {
        existing.count = Math.max(existing.count, entry.count);
      } else {
        uniqueTopTypes.push({ ...entry });
      }
    }
    uniqueTopTypes.sort((a, b) => b.count - a.count);
    const bpuEntries = this.bpuAutoEntries();
    const bpuCodes = this.bpuCodes();
    const applyBpuFilter = bpuCodes.size > 0 && bpuEntries.length > 0;
    const bpuTopTypes = applyBpuFilter
      ? bpuEntries.map((entry) => ({
          label: entry.code,
          count: types.get(this.normalizeToken(entry.code).replace(/[^A-Z0-9_]/g, '')) ?? 0
        }))
      : [];
    const filteredBpuTopTypes = applyBpuFilter && allowedType
      ? bpuTopTypes.filter((entry) => {
          const normalizedEntry = this.normalizeToken(entry.label);
          const normalizedAllowed = this.normalizeToken(this.normalizeTypeLabel(allowedType));
          return normalizedEntry === normalizedAllowed;
        })
      : bpuTopTypes;
    filteredBpuTopTypes.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label).localeCompare(String(b.label));
    });
    const bpuOnlyTopTypes = applyBpuFilter ? filteredBpuTopTypes : null;
    const bpuFilteredTopTypes = applyBpuFilter
      ? uniqueTopTypes.filter((entry) => bpuCodes.has(this.labelToBpuCode(entry.label)))
      : uniqueTopTypes;
    const filteredTopTypes = allowedType
      ? bpuFilteredTopTypes
      : bpuFilteredTopTypes.filter((entry) => !this.isRaccType(entry.label) && !this.isPavLabel(entry.label));
    const allowedLabel = allowedType ? this.normalizeTypeLabel(allowedType) : '';
    const normalizedAllowed = this.normalizeToken(allowedType);
    const normalizedAllowedLabel = this.normalizeToken(allowedLabel);
    const computedTopTypes = allowedType
      ? filteredTopTypes.filter((entry) => {
          const normalizedEntry = this.normalizeToken(entry.label);
          return normalizedEntry === normalizedAllowed || normalizedEntry === normalizedAllowedLabel;
        })
      : filteredTopTypes;
    const finalTopTypes = (bpuOnlyTopTypes ?? computedTopTypes).filter((entry) =>
      entry.count > 0 && !this.isCablePavLabel(entry.label) && !this.isClemLabel(entry.label)
    );
    const ALWAYS_STATUSES = ['ECHEC TERMINE', 'ECHEC', 'ANNULEE', 'A COMPLETER'];
    for (const label of ALWAYS_STATUSES) {
      if (!statuses.has(label)) statuses.set(label, 0);
    }
    const topStatuses = Array.from(statuses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count }));
    const mandatoryStatuses = ['CLOTURE TERMINEE', 'ECHEC TERMINE', 'ECHEC', 'ANNULEE', 'A COMPLETER'];
    for (const label of mandatoryStatuses) {
      if (!topStatuses.some((entry) => entry.label === label)) {
        topStatuses.push({ label, count: statuses.get(label) ?? 0 });
      }
    }
    const mandatorySet = new Set(mandatoryStatuses);
    const reorderedTopStatuses = [
      ...mandatoryStatuses
        .map((label) => topStatuses.find((entry) => entry.label === label))
        .filter((entry): entry is { label: string; count: number } => Boolean(entry)),
      ...topStatuses.filter((entry) => !mandatorySet.has(entry.label))
    ];

    const denominator = success + failure;

    if (missingTypeRows.length) {
      console.groupCollapsed('[FXN] Interventions cloture terminee sans type detecte');
      console.table(missingTypeRows);
      console.groupEnd();
    }
    if (dominantDebugRows.length) {
      console.groupCollapsed('[FXN] Debug dominant types (cloture terminee)');
      console.table(dominantDebugRows);
      const highlightRows = dominantDebugRows
        .map((row, index) => ({ row, index }))
        .filter((entry) => entry.row.dominantInArticles);
      console.groupEnd();
    }

    return {
      total,
      success,
      failure,
      avgDuration: durationCount ? Math.round(durationSum / durationCount) : 0,
      avgFailureDuration: failureDurationCount ? Math.round(failureDurationSum / failureDurationCount) : 0,
      successRate: denominator ? Math.round((success / denominator) * 100) : 0,
      topTechnicians,
      topTypes: finalTopTypes,
      topStatuses: reorderedTopStatuses,
      cancelled
    };
  }

  totalAmount(): number {
    const rates = this.ratesService.rates();
    const rawType = this.filterForm.getRawValue().type || '';
    const normalizedType = this.normalizeFilterType(rawType);
    if (normalizedType) {
      const count = this.countClosedByType(normalizedType);
      const rate = this.rateForType(normalizedType, rates);
      return Math.round(count * rate * 100) / 100;
    }
    this.logAmountBreakdown(rates);
    return this.computeTotalAmount(this.summaryTotals(), rates);
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

  private computeTotalAmount(totals: InterventionTotals | null, rates: InterventionRates): number {
    if (!totals) return 0;
    const get = (value?: number) => (Number.isFinite(value as number) ? Number(value) : 0);
    let amount = 0;
    amount += get(totals.racPavillon) * rates.racPavillon.total;
    amount += get(totals.clem) * rates.clem.total;
    amount += get(totals.reconnexion) * rates.reconnexion.total;
    amount += get(totals.racImmeuble) * rates.racImmeuble.total;
    amount += get(totals.racProS) * rates.racProS.total;
    amount += get(totals.racProC) * rates.racProC.total;
    amount += get(totals.racF8) * rates.racF8.total;
    amount += get(totals.prestaCompl) * rates.prestaCompl.total;
    amount += get(totals.deplacementPrise ?? totals.deprise) * rates.deplacementPrise.total;
    amount += get(totals.demo) * rates.demo.total;
    amount += get(totals.sav) * rates.sav.total;
    amount += get(totals.savExp) * rates.savExp.total;
    amount += get(totals.refrac) * rates.refrac.total;
    amount += get(totals.refcDgr) * rates.refcDgr.total;
    return Math.round(amount * 100) / 100;
  }

  private computeDuration(item: InterventionItem): number {
    const start = item.debutIntervention || item.debut;
    const end = item.clotureHotline || item.clotureTech;
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return 0;
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
  }

  private computeFailureDuration(item: InterventionItem): number {
    const start = item.debutIntervention || item.debut;
    const end = item.clotureTech;
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return 0;
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
  }

  formatDuration(item: InterventionItem): string {
    const minutes = this.computeDuration(item);
    if (minutes <= 0) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (remainder === 0) return `${hours} h`;
    return `${hours} h ${remainder} min`;
  }

  displayType(item: InterventionItem): string {
    const label = this.normalizeTypeLabel(this.canonicalType(item.type, item));
    return label || '—';
  }

  private updateStatsDataset(items: InterventionItem[], totalCount: number, lastQuery: InterventionSummaryQuery): void {
    const safeTotal = Number.isFinite(totalCount) ? totalCount : items.length;
    if (!safeTotal) {
      this.statsDataset.set([]);
      return;
    }
    const limitUsed = lastQuery.limit ?? this.limit();
    if (safeTotal <= limitUsed) {
      this.statsDataset.set(this.applyStrictStatsFilters(items));
      return;
    }
    const statsQuery = this.buildQuery({ includePagination: false });
    statsQuery.page = 1;
    statsQuery.limit = safeTotal;
    this.svc.list(statsQuery).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.statsDataset.set(this.applyStrictStatsFilters(items));
          return;
        }
        const incoming = res.data.items || items;
        this.statsDataset.set(this.applyStrictStatsFilters(incoming));
      },
      error: () => {
        this.statsDataset.set(this.applyStrictStatsFilters(items));
      }
    });
  }

  private sortedItems(): InterventionItem[] {
    const items = [...this.interventions()];
    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    const compare = (a: any, b: any): number => {
      if (a === b) return 0;
      if (a === null || a === undefined) return -1;
      if (b === null || b === undefined) return 1;
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    };

    return items.sort((a, b) => {
      switch (field) {
        case 'date': {
          const dateA = new Date(a.dateRdv || a.debut || '');
          const dateB = new Date(b.dateRdv || b.debut || '');
          const diff = dateA.getTime() - dateB.getTime();
          return direction * (Number.isFinite(diff) ? diff : 0);
        }
        case 'type':
          return direction * compare(this.displayType(a), this.displayType(b));
        case 'statut':
          return direction * compare(a.statut, b.statut);
        case 'duree': {
          const durationA = this.computeDuration(a);
          const durationB = this.computeDuration(b);
          const cancelledA = this.isCancelledStatus(a.statut);
          const cancelledB = this.isCancelledStatus(b.statut);
          const valueA = cancelledA ? Number.POSITIVE_INFINITY : durationA;
          const valueB = cancelledB ? Number.POSITIVE_INFINITY : durationB;
          return direction * (valueA - valueB);
        }
      }
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  applyView(view: 'topTech' | 'failures' | 'reconnections'): void {
    if (view === 'failures') {
      this.filterForm.controls.status.setValue(this.chooseFailureStatus());
      this.filterForm.controls.type.setValue('');
      this.sortField.set('duree');
      this.sortDirection.set('desc');
    } else if (view === 'reconnections') {
      this.filterForm.controls.status.setValue('');
      this.filterForm.controls.type.setValue(this.chooseReconnectionType());
    }
    if (view === 'topTech') {
      this.sortField.set('duree');
      this.sortDirection.set('desc');
    }
    this.page.set(1);
    this.loadInterventions();
  }

  private chooseFailureStatus(): string {
    const statuses = this.filters()?.statuses ?? [];
    const preferred = statuses.find((status) => this.isFailureTerminated(status));
    return preferred ?? 'Échec terminée';
  }

  private chooseClosedStatus(): string {
    const statuses = this.filters()?.statuses ?? [];
    const closed = statuses.find((status) => this.isClosedTerminated(status));
    return closed ?? 'Clôture terminée';
  }

  private chooseReconnectionType(): string {
    const types = this.filters()?.types ?? [];
    const candidate = types.find((type) => this.isReconnectionType(type));
    return candidate ?? 'RECO';
  }

  private isFailureTerminated(status?: string): boolean {
    if (!status) return false;
    const normalized = this.normalizeToken(status);
    return normalized.includes('ECHEC') && normalized.includes('TERMINE');
  }

  private isClosedTerminated(status?: string): boolean {
    if (!status) return false;
    const normalized = this.normalizeToken(status);
    return normalized.includes('CLOTURE') && normalized.includes('TERMINE');
  }

  private isReconnectionType(type?: string): boolean {
    if (!type) return false;
    const normalized = this.normalizeToken(type);
    return normalized.includes('RECO');
  }

  private isCancelledStatus(status?: string): boolean {
    if (!status) return false;
    return status.toLowerCase().includes('annul');
  }

  private extractCodeTokens(value?: string | null): string[] {
    if (!value) return [];
    return String(value)
      .split(/[,;+]/)
      .map((entry) => entry.replace(/"/g, '').trim())
      .filter(Boolean)
      .map((entry) => entry.replace(/\s+x?\d+$/i, '').trim())
      .map((entry) => entry.replace(/\s+/g, '_'))
      .map((entry) => entry.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase())
      .filter(Boolean);
  }

  private hasCode(value: string | null | undefined, code: string): boolean {
    if (!value) return false;
    const target = code.toUpperCase();
    return this.extractCodeTokens(value).some((token) => token === target);
  }

  private canonicalType(value?: string, item?: InterventionItem): string {
    const raw = (value ?? '').trim();
    const normalizedType = this.normalizeToken(raw).replace(/-/g, ' ');
    const normalizedTypeCollapsed = normalizedType.replace(/\s+/g, ' ').trim();
    const articlesNormalized = this.normalizeToken(item?.articlesRaw);
    const prestationsNormalized = this.normalizeToken(item?.listePrestationsRaw);
    const statusNormalized = this.normalizeToken(item?.statut);
    const commentsNormalized = this.normalizeToken(item?.commentairesTechnicien);
    if (isRacpavSuccess(item?.statut, item?.articlesRaw)) {
      return 'RACPAV';
    }
    if (isRacihSuccess(item?.statut, item?.articlesRaw)) {
      return 'RACIH';
    }
    const isSfrB2b = this.isSfrB2bMarque(item?.marque);
    if (
      statusNormalized.includes('CLOTURE')
      && statusNormalized.includes('TERMINEE')
      && (articlesNormalized.includes('RECOIP') || normalizedType === 'RECO')
      && !isSfrB2b
    ) {
      return 'RECOIP';
    }
    if (
      statusNormalized.includes('CLOTURE')
      && statusNormalized.includes('TERMINEE')
      && isSfrB2b
    ) {
      return 'RACPRO_S';
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      return 'RACPRO_S';
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      return 'RACPRO_C';
    }
    if (
      this.hasCode(item?.articlesRaw, 'SAV')
      || this.hasCode(item?.listePrestationsRaw, 'SAV')
      || normalizedTypeCollapsed === 'SAV'
    ) {
      return 'SAV';
    }
    if (
      (normalizedType.includes('PRESTA') && normalizedType.includes('COMPL'))
      || articlesNormalized.includes('PRESTA_COMPL')
      || prestationsNormalized.includes('PRESTA_COMPL')
    ) {
      return 'PRESTA_COMPL';
    }
    if (
      articlesNormalized.includes('REPFOU_PRI')
      || commentsNormalized.includes('F8')
      || prestationsNormalized.includes('FOURREAUX')
      || prestationsNormalized.includes('DOMAINE')
    ) {
      return 'REPFOU_PRI';
    }
    if (normalizedTypeCollapsed === 'REFC_DGR' || statusNormalized.includes('REFC_DGR') || prestationsNormalized.includes('REFC_DGR')) {
      return 'REFC_DGR';
    }
    if (normalizedTypeCollapsed === 'DEPLPRISE' || articlesNormalized.includes('DEPLPRISE') || prestationsNormalized.includes('DEPLPRISE')) {
      return 'DEPLPRISE';
    }
    if (normalizedTypeCollapsed === 'DEMO' || articlesNormalized.includes('DEMO') || prestationsNormalized.includes('DEMO')) {
      return 'DEMO';
    }
    if (
      normalizedTypeCollapsed === 'SAV_EXP'
      || normalizedTypeCollapsed === 'SAV EXP'
      || articlesNormalized.includes('SAV_EXP')
      || prestationsNormalized.includes('SAV_EXP')
    ) {
      return 'SAV_EXP';
    }
    if (normalizedTypeCollapsed === 'REFRAC' || articlesNormalized.includes('REFRAC') || prestationsNormalized.includes('REFRAC')) {
      return 'REFRAC';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 1')
      || normalizedTypeCollapsed.includes('CABLE_PAV_1')
      || articlesNormalized.includes('CABLE_PAV_1')
      || articlesNormalized.includes('CABLE PAV 1')
      || prestationsNormalized.includes('CABLE_PAV_1')
      || prestationsNormalized.includes('CABLE PAV 1')
    ) {
      return 'CABLE_PAV_1';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 2')
      || normalizedTypeCollapsed.includes('CABLE_PAV_2')
      || articlesNormalized.includes('CABLE_PAV_2')
      || articlesNormalized.includes('CABLE PAV 2')
      || prestationsNormalized.includes('CABLE_PAV_2')
      || prestationsNormalized.includes('CABLE PAV 2')
    ) {
      return 'CABLE_PAV_2';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 3')
      || normalizedTypeCollapsed.includes('CABLE_PAV_3')
      || articlesNormalized.includes('CABLE_PAV_3')
      || articlesNormalized.includes('CABLE PAV 3')
      || prestationsNormalized.includes('CABLE_PAV_3')
      || prestationsNormalized.includes('CABLE PAV 3')
    ) {
      return 'CABLE_PAV_3';
    }
    if (
      normalizedTypeCollapsed.includes('CABLE PAV 4')
      || normalizedTypeCollapsed.includes('CABLE_PAV_4')
      || articlesNormalized.includes('CABLE_PAV_4')
      || articlesNormalized.includes('CABLE PAV 4')
      || prestationsNormalized.includes('CABLE_PAV_4')
      || prestationsNormalized.includes('CABLE PAV 4')
    ) {
      return 'CABLE_PAV_4';
    }
    if (!raw) return 'Autre';
    if (normalizedTypeCollapsed === 'RACIH') {
      return 'RACIH';
    }
    return TYPE_CANONICAL_ALIASES.get(normalizedTypeCollapsed) ?? raw;
  }

  private resolveDominantTypes(item: InterventionItem): string[] {
    if (!this.isClosedTerminated(item.statut)) return [];
    const types: string[] = [];
    const statusNormalized = this.normalizeToken(item.statut);
    const typeNormalized = this.normalizeToken(item.type).replace(/-/g, ' ').trim();
    const typeOperationNormalized = this.normalizeToken(item.typeOperation);
    const logementNormalized = this.normalizeToken(item.typeLogement);
    const marqueNormalized = this.normalizeToken(item.marque);
    const commentsNormalized = this.normalizeToken(item.commentairesTechnicien);

    if (isRacpavSuccess(item.statut, item.articlesRaw)) {
      types.push('RACPAV');
    }
    if (isRacihSuccess(item.statut, item.articlesRaw)) {
      if (!types.includes('RACIH')) {
        types.push('RACIH');
      }
    }
    const isSfrB2b = this.isSfrB2bMarque(item.marque);
    if ((this.hasCode(item.articlesRaw, 'RECOIP') || typeNormalized === 'RECO') && !isSfrB2b) {
      types.push('RECOIP');
    }
    if (statusNormalized.includes('RACPRO_S') || marqueNormalized.includes('B2B')) {
      types.push('RACPRO_S');
    }
    if (this.hasCode(item.articlesRaw, 'RACPRO_C')) {
      types.push('RACPRO_C');
    }
    if (this.hasCode(item.articlesRaw, 'SAV') || typeNormalized === 'SAV') {
      types.push('SAV');
    }
    if (
      this.hasCode(item.articlesRaw, 'SAV_EXP')
      || this.hasCode(item.listePrestationsRaw, 'SAV_EXP')
      || typeNormalized === 'SAV EXP'
      || typeNormalized === 'SAV_EXP'
    ) {
      types.push('SAV_EXP');
    }
    if (this.hasCode(item.articlesRaw, 'CLEM')) {
      types.push('CLEM');
    }
    if (
      typeNormalized === 'PRESTA COMPL'
      || this.hasCode(item.articlesRaw, 'PRESTA_COMP')
      || this.hasCode(item.articlesRaw, 'PRESTA_COMPL')
      || this.hasCode(item.listePrestationsRaw, 'PRESTA_COMPL')
    ) {
      types.push('PRESTA_COMPL');
    }
    if (this.hasCode(item.articlesRaw, 'REPFOU_PRI') || commentsNormalized.includes('F8')) {
      types.push('REPFOU_PRI');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_1')) {
      types.push('CABLE_PAV_1');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_2')) {
      types.push('CABLE_PAV_2');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_3')) {
      types.push('CABLE_PAV_3');
    }
    if (this.hasCode(item.articlesRaw, 'CABLE_PAV_4')) {
      types.push('CABLE_PAV_4');
    }
    if (this.hasCode(item.articlesRaw, 'DEPLPRISE') || this.hasCode(item.listePrestationsRaw, 'DEPLPRISE') || typeNormalized === 'DEPLPRISE') {
      types.push('DEPLPRISE');
    }
    if (this.hasCode(item.articlesRaw, 'DEMO') || this.hasCode(item.listePrestationsRaw, 'DEMO') || typeNormalized === 'DEMO') {
      types.push('DEMO');
    }
    if (this.hasCode(item.articlesRaw, 'REFRAC') || this.hasCode(item.listePrestationsRaw, 'REFRAC') || typeNormalized === 'REFRAC') {
      types.push('REFRAC');
    }
    if (
      this.hasCode(item.articlesRaw, 'REFC_DGR')
      || this.hasCode(item.listePrestationsRaw, 'REFC_DGR')
      || typeNormalized === 'REFC DGR'
      || typeNormalized === 'REFC_DGR'
    ) {
      types.push('REFC_DGR');
    }
    return types;
  }

  private normalizeFilterType(value?: string): string {
    const normalized = this.normalizeToken(value).replace(/[^A-Z0-9_]/g, '');
    if (!normalized) return '';
    const aliases = new Map([
      ['RACPAV', 'RACPAV'],
      ['RACIH', 'RACIH'],
      ['RECOIP', 'RECOIP'],
      ['RECO', 'RECOIP'],
      ['RACPROS', 'RACPRO_S'],
      ['RACPRO_S', 'RACPRO_S'],
      ['RACPROC', 'RACPRO_C'],
      ['RACPRO_C', 'RACPRO_C'],
      ['CLEM', 'CLEM'],
      ['SAV', 'SAV'],
      ['PRESTACOMPL', 'PRESTA_COMPL'],
      ['PRESTA_COMPL', 'PRESTA_COMPL'],
      ['PRESTAF8', 'REPFOU_PRI'],
      ['REPFOU_PRI', 'REPFOU_PRI'],
      ['REFC_DGR', 'REFC_DGR'],
      ['REFCDGR', 'REFC_DGR'],
      ['DEPLPRISE', 'DEPLPRISE'],
      ['REFRAC', 'REFRAC'],
      ['DEMO', 'DEMO'],
      ['SAVEXP', 'SAV_EXP'],
      ['SAV_EXP', 'SAV_EXP'],
      ['CABLE_PAV_1', 'CABLE_PAV_1'],
      ['CABLE_PAV_2', 'CABLE_PAV_2'],
      ['CABLE_PAV_3', 'CABLE_PAV_3'],
      ['CABLE_PAV_4', 'CABLE_PAV_4'],
      ['CABLEPAV1', 'CABLE_PAV_1'],
      ['CABLEPAV2', 'CABLE_PAV_2'],
      ['CABLEPAV3', 'CABLE_PAV_3'],
      ['CABLEPAV4', 'CABLE_PAV_4']
    ]);
    return aliases.get(normalized) ?? '';
  }

  private normalizeTypeLabel(label: string): string {
    const normalized = this.normalizeToken(label);
    if (normalized === 'RACPAV') return 'RACPAV';
    if (normalized === 'RECOIP') return 'RECO';
    if (normalized === 'RACPRO_S') return 'PRO S';
    if (normalized === 'RACPRO_C') return 'PRO C';
    if (normalized === 'REPFOU_PRI') return 'PRESTA F8';
    if (normalized === 'PRESTA_COMPL') return 'PRESTA COMPL';
    if (normalized === 'IMM' || normalized === 'RACIH') return 'RACIH';
    if (normalized === 'CABLE_PAV_1') return 'CABLE PAV 1';
    if (normalized === 'CABLE_PAV_2') return 'CABLE PAV 2';
    if (normalized === 'CABLE_PAV_3') return 'CABLE PAV 3';
    if (normalized === 'CABLE_PAV_4') return 'CABLE PAV 4';
    if (normalized === 'SAV_EXP') return 'SAV EXP';
    if (normalized === 'REFC_DGR') return 'REFC DGR';
    return label;
  }

  private labelToBpuCode(label: string): string {
    const normalized = this.normalizeToken(label).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const map = new Map([
      ['PRO S', 'RACPRO_S'],
      ['PRO C', 'RACPRO_C'],
      ['RACPAV', 'RACPAV'],
      ['RACIH', 'RACIH'],
      ['RECO', 'RECOIP'],
      ['RECOIP', 'RECOIP'],
      ['CLEM', 'CLEM'],
      ['SAV', 'SAV'],
      ['SAV EXP', 'SAV_EXP'],
      ['PRESTA COMPL', 'PRESTA_COMPL'],
      ['PRESTA F8', 'REPFOU_PRI'],
      ['DEPLPRISE', 'DEPLPRISE'],
      ['DEMO', 'DEMO'],
      ['REFRAC', 'REFRAC'],
      ['REFC DGR', 'REFC_DGR'],
      ['CABLE PAV 1', 'CABLE_PAV_1'],
      ['CABLE PAV 2', 'CABLE_PAV_2'],
      ['CABLE PAV 3', 'CABLE_PAV_3'],
      ['CABLE PAV 4', 'CABLE_PAV_4']
    ]);
    if (map.has(normalized)) return map.get(normalized)!;
    return normalized.replace(/\s+/g, '_');
  }

  private isRaccType(label: string): boolean {
    const normalized = this.normalizeToken(label);
    return normalized.includes('RACC');
  }

  private isPavLabel(label: string): boolean {
    const normalized = this.normalizeToken(label);
    return normalized === 'PAV';
  }

  private isCablePavLabel(label: string): boolean {
    const normalized = this.normalizeToken(label);
    const underscored = normalized.replace(/[\s-]+/g, '_');
    const compact = normalized.replace(/[\s_-]+/g, '');
    return underscored.startsWith('CABLE_PAV') || compact.startsWith('CABLEPAV');
  }

  private isClemLabel(label: string): boolean {
    return this.normalizeToken(label) === 'CLEM';
  }

  private matchesAllowedType(typeLabel: string, allowedType: string): boolean {
    if (!allowedType) return true;
    const normalizedType = this.normalizeToken(typeLabel);
    const normalizedAllowed = this.normalizeToken(allowedType);
    if (normalizedAllowed === 'RACIH' && normalizedType === 'IMM') return true;
    if (normalizedAllowed === 'RACPAV' && (normalizedType === 'RACC' || normalizedType === 'RACPAV')) return true;
    return normalizedType === normalizedAllowed;
  }

  private isAllowedArticleLabel(label: string, allowedLabel: string): boolean {
    if (!allowedLabel) return true;
    return this.normalizeToken(label) === this.normalizeToken(allowedLabel);
  }

  private computeFailurePercent(stats: TechnicianInterventionStats): number {
    const denominator = stats.success + stats.failure;
    if (!denominator) return 0;
    return Math.round((stats.failure / denominator) * 100);
  }

  private computeSuccessRateBg(rate: number): string {
    const clamped = Math.max(0, Math.min(100, rate));
    const step = 4;
    const quantized = Math.min(100, Math.max(0, Math.round(clamped / step) * step));
    const t = quantized / 100;
    const start = { r: 239, g: 68, b: 68 };
    const end = { r: 46, g: 140, b: 108 };
    const lerp = (startValue: number, endValue: number) =>
      Math.round(startValue + (endValue - startValue) * t);
    return `rgb(${lerp(start.r, end.r)}, ${lerp(start.g, end.g)}, ${lerp(start.b, end.b)})`;
  }

  private countMatchingType(target: string): number {
    if (!target) return 0;
    const normalizedTarget = target.toLowerCase();
    return this.statsDataset().reduce((acc, item) => {
      const typeLabel = this.canonicalType(item.type, item).toLowerCase();
      return typeLabel === normalizedTarget ? acc + 1 : acc;
    }, 0);
  }

  statusClass(item: InterventionItem): string {
    const stat = (item.statut ?? '').toLowerCase();
    if (stat.includes('echec') || stat.includes('fail')) return 'status-error';
    if (stat.includes('termine') || stat.includes('complet') || stat.includes('ok')) return 'status-success';
    return 'status-neutral';
  }

  formatTechnicianName(item: InterventionItem): string {
    const formatted = formatPersonName(item.techFirstName ?? '', item.techLastName ?? '');
    return formatted || '–';
  }

  openDetails(item: InterventionItem): void {
    this.selectedDetail.set(item);
    this.detailOpen.set(true);
  }

  closeDetails(): void {
    this.detailOpen.set(false);
    this.selectedDetail.set(null);
  }

  detailEntries(): Array<{ label: string; value: string }> {
    const item = this.selectedDetail();
    if (!item) return [];
    return this.detailFields.map((field) => ({
      label: field.label,
      value: this.formatDetailValueByKey(field.key, item[field.key])
    }));
  }

  private formatDetailValueByKey(key: keyof InterventionItem, value: unknown): string {
    if (key === 'type') {
      return this.displayType(this.selectedDetail() as InterventionItem);
    }
    if (key === 'listePrestationsRaw') {
      return this.formatPrestationsRaw(value);
    }
    return this.formatDetailValue(value);
  }

  private formatDetailValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    return String(value);
  }

  private formatPrestationsRaw(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const raw = String(value);
    const parts = raw
      .split(/[,;+]/)
      .map((entry) => entry.replace(/"/g, '').trim())
      .filter(Boolean)
      .map((entry) => entry.split(/\s+/)[0])
      .map((entry) => entry.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase())
      .filter(Boolean)
      .filter((code) => code !== 'SAV_EXP');

    if (!parts.length) return '—';
    const seen = new Set<string>();
    const unique = [];
    for (const code of parts) {
      if (seen.has(code)) continue;
      seen.add(code);
      unique.push(code);
    }
    return unique.join(', ');
  }

  technicianLabel(tech: User): string {
    return this.formatTechnicianName({ techFirstName: tech.firstName, techLastName: tech.lastName } as any);
  }

  topStatusCount(keyword: string): number {
    const label = keyword.toLowerCase();
    const entry = this.stats()
      ?.topStatuses.find((s) => s.label?.toLowerCase().includes(label));
    return entry?.count ?? this.stats().failure;
  }

  topStatusSummary(): string {
    const labels = this.stats()
      .topStatuses.map((s) => s.label)
      .filter(Boolean);
    return labels.length ? labels.join(', ') : '—';
  }

  frequentStatusClass(label?: string): string {
    const normalized = this.normalizeToken(label);
    if (normalized.includes('CLOTURE') && normalized.includes('TERMINEE')) {
      return 'status-success';
    }
    if (normalized.includes('ANNULE')) {
      return 'status-neutral';
    }
    if (normalized.includes('ECHEC')) {
      return 'status-error';
    }
    return '';
  }

  private apiError(err: any, fallback: string): string {
    if (typeof err?.error === 'object' && err.error !== null && 'message' in err.error) {
      return String(err.error.message ?? fallback);
    }
    return err?.message || fallback;
  }

  private normalizeToken(value?: string | null): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private isSfrB2bMarque(value?: string | null): boolean {
    const normalized = this.normalizeToken(value ?? '');
    if (!normalized) return false;
    if (normalized.includes('SFR B2B')) return true;
    return normalized.replace(/\s+/g, '').includes('SFRB2B');
  }

  private resolveSuccessPrestations(item: InterventionItem): string[] {
    if (!this.isClosedTerminated(item.statut)) return [];
    const typeNormalized = this.normalizeToken(item.type).replace(/-/g, ' ').trim();
    const articlesNormalized = this.normalizeToken(item.articlesRaw);
    const statusNormalized = this.normalizeToken(item.statut);
    const commentsNormalized = this.normalizeToken(item.commentairesTechnicien);
    const prestationsNormalized = this.normalizeToken(item.listePrestationsRaw);
    const matches: string[] = [];

    if (isRacpavSuccess(item.statut, item.articlesRaw)) matches.push('RACPAV');
    if (isRacihSuccess(item.statut, item.articlesRaw)) {
      matches.push('RACIH');
    }
    const isSfrB2b = this.isSfrB2bMarque(item.marque);
    if (
      !isSfrB2b
      && (
        articlesNormalized.includes('RECOIP')
        || typeNormalized === 'RECO'
      )
    ) {
      matches.push('RECOIP');
    }
    if (isSfrB2b) {
      matches.push('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      matches.push('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      matches.push('RACPRO_C');
    }
    if (this.hasCode(item.articlesRaw, 'CLEM')) {
      matches.push('CLEM');
    }
    if (
      typeNormalized.includes('CABLE_PAV_1')
      || typeNormalized.includes('CABLE PAV 1')
      || articlesNormalized.includes('CABLE_PAV_1')
      || articlesNormalized.includes('CABLE PAV 1')
    ) {
      matches.push('CABLE_PAV_1');
    }
    if (
      typeNormalized.includes('CABLE_PAV_2')
      || typeNormalized.includes('CABLE PAV 2')
      || articlesNormalized.includes('CABLE_PAV_2')
      || articlesNormalized.includes('CABLE PAV 2')
    ) {
      matches.push('CABLE_PAV_2');
    }
    if (
      typeNormalized.includes('CABLE_PAV_3')
      || typeNormalized.includes('CABLE PAV 3')
      || articlesNormalized.includes('CABLE_PAV_3')
      || articlesNormalized.includes('CABLE PAV 3')
    ) {
      matches.push('CABLE_PAV_3');
    }
    if (
      typeNormalized.includes('CABLE_PAV_4')
      || typeNormalized.includes('CABLE PAV 4')
      || articlesNormalized.includes('CABLE_PAV_4')
      || articlesNormalized.includes('CABLE PAV 4')
    ) {
      matches.push('CABLE_PAV_4');
    }
    if (
      this.hasCode(item?.articlesRaw, 'SAV')
      || this.hasCode(item?.listePrestationsRaw, 'SAV')
      || typeNormalized === 'SAV'
    ) {
      matches.push('SAV');
    }
    if (
      (typeNormalized.includes('PRESTA') && typeNormalized.includes('COMPL'))
      || articlesNormalized.includes('PRESTA_COMPL')
    ) {
      matches.push('PRESTA_COMPL');
    }
    if (
      articlesNormalized.includes('REPFOU_PRI')
      || commentsNormalized.includes('F8')
      || prestationsNormalized.includes('FOURREAUX')
      || prestationsNormalized.includes('DOMAINE')
    ) {
      matches.push('REPFOU_PRI');
    }
    if (typeNormalized === 'REFC_DGR' || statusNormalized.includes('REFC_DGR')) {
      matches.push('REFC_DGR');
    }
    if (typeNormalized === 'DEPLPRISE' || articlesNormalized.includes('DEPLPRISE')) {
      matches.push('DEPLPRISE');
    }
    if (typeNormalized === 'REFRAC' || articlesNormalized.includes('REFRAC')) {
      matches.push('REFRAC');
    }

    return matches;
  }
}
