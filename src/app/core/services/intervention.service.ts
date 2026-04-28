import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type BpuAnalysisStats = {
  totalLines: number;
  linesWithArticles: number;
  totalArticleOccurrences: number;
  matchedOccurrences: number;
  unknownOccurrences: number;
  matchRate: number;
  uniqueMatchedCodes: number;
  uniqueUnknownCodes: number;
};

export type BpuAnalysisAdminInfo = {
  code: string;
  source: 'BPU' | 'PRESTATION';
  label: string;
  unitPrice: number | null;
  segment?: string;
};

export type BpuAnalysisSuggestion = {
  code: string;
  label: string;
  distance: number;
};

export type BpuAnalysisUnknownEntry = {
  count: number;
  suggestions: BpuAnalysisSuggestion[];
  rawExamples: string[];
};

export type BpuAnalysisReport = {
  stats: BpuAnalysisStats;
  unknownCodes: Record<string, BpuAnalysisUnknownEntry>;
  notSeenInCsv: BpuAnalysisAdminInfo[];
  analyzedAt: string;
};

export type InterventionSummaryItem = {
  technician: string;
  technicienId?: string | null;
  total: number;
  racPavillon: number;
  racSouterrain?: number;
  racAerien?: number;
  racFacade?: number;
  racImmeuble: number;
  reconnexion: number;
  racF8: number;
  fourreauBeton?: number;     // FOURREAU_CASSE_BETON (nouveau)
  racProS: number;
  racProC?: number;
  prestaCompl?: number;
  sav: number;
  clem: number;
  deplacementPrise?: number;  // DEPLACEMENT_PRISE (ex deprise)
  /** @deprecated Utiliser deplacementPrise */
  deprise?: number;
  demo?: number;
  refrac?: number;
  refcDgr?: number;
  savExp?: number;
  deplacementOffert?: number;
  deplacementATort?: number;
  swapEquipement?: number;
  bifibre?: number;           // BIFIBRE (nouveau)
  nacelle?: number;           // NACELLE (nouveau)
  cableSl?: number;           // CABLE_SL (ex cablePav1/2/3/4)
  /** @deprecated Utiliser cableSl */
  cablePav1?: number;
  /** @deprecated Utiliser cableSl */
  cablePav2?: number;
  /** @deprecated Utiliser cableSl */
  cablePav3?: number;
  /** @deprecated Utiliser cableSl */
  cablePav4?: number;
  racAutre: number;
  other: number;
};

export type InterventionTotals = {
  total: number;
  racPavillon: number;
  racSouterrain?: number;
  racAerien?: number;
  racFacade?: number;
  racImmeuble: number;
  reconnexion: number;
  racF8: number;
  fourreauBeton?: number;     // FOURREAU_CASSE_BETON (nouveau)
  racProS: number;
  racProC?: number;
  prestaCompl?: number;
  sav: number;
  clem: number;
  deplacementPrise?: number;  // DEPLACEMENT_PRISE (ex deprise)
  /** @deprecated Utiliser deplacementPrise */
  deprise?: number;
  demo?: number;
  refrac?: number;
  refcDgr?: number;
  savExp?: number;
  deplacementOffert?: number;
  deplacementATort?: number;
  swapEquipement?: number;
  bifibre?: number;           // BIFIBRE (nouveau)
  nacelle?: number;           // NACELLE (nouveau)
  cableSl?: number;           // CABLE_SL (ex cablePav1/2/3/4)
  /** @deprecated Utiliser cableSl */
  cablePav1?: number;
  /** @deprecated Utiliser cableSl */
  cablePav2?: number;
  /** @deprecated Utiliser cableSl */
  cablePav3?: number;
  /** @deprecated Utiliser cableSl */
  cablePav4?: number;
  racAutre: number;
  other: number;
};

export type InterventionSummary = {
  items: InterventionSummaryItem[];
  totals: InterventionTotals;
};

export type InterventionSummaryResponse = InterventionSummary & {
  total?: number;
  page?: number;
  limit?: number;
};

export type InterventionItem = {
  _id: string;
  numInter: string;
  commandeId?: string;
  technicienId?: string | null;
  dateRdv?: string | null;
  region?: string;
  plaque?: string;
  societe?: string;
  clientOperateur?: string;
  techFirstName?: string;
  techLastName?: string;
  techFull?: string;
  type?: string;
  client?: string;
  statut?: string;
  heureRdvPlanifiee?: string;
  dureePlanifiee?: string;
  heureDebutReelle?: string;
  heureClotureTech?: string;
  heureClotureHotline?: string;
  commentairesTechnicien?: string;
  commentairesCloture?: string;
  debut?: string;
  duree?: string;
  clotureHotline?: string;
  clotureTech?: string;
  debutIntervention?: string;
  creneauPlus2h?: string;
  motifEchec?: string;
  ville?: string;
  typeLogement?: string;
  actionSav?: string;
  longueurCable?: string;
  typePbo?: string;
  typeOperation?: string;
  typeHabitation?: string;
  priseExistante?: string;
  marque?: string;
  articlesUtilises?: string;
  listePrestationsRaw?: string;
  recoRacc?: string;
  isSuccess?: boolean;
  isFailure?: boolean;
  sav24?: boolean;
  savRouge?: boolean;
  nbRdv?: number;
  occurrencesAbo90j?: number;
  versionIndex?: number;
  latestVersionId?: string;
  articlesRaw?: string;
  categories?: string[];
  importedAt?: string;
  osirisRaw?: Record<string, string>;
  osirisFields?: Record<string, string>;
};

export type InterventionListResponse = {
  total: number;
  page: number;
  limit: number;
  items: InterventionItem[];
};

export type InterventionFilters = {
  regions: string[];
  clients: string[];
  societes: string[];
  plaques: string[];
  villes: string[];
  statuses: string[];
  technicians: string[];
  types: string[];
  gestionnaires: string[];
  activites: string[];
  typeOffres: string[];
  typePons: string[];
  marques: string[];
  marqueGps: string[];
  gems: string[];
  categoriesRdv: string[];
  statutsBox4g: string[];
  typeLogements: string[];
  parcours: string[];
  multiSavs: string[];
  equipements: string[];
  regroupSavs: string[];
  flagBots: string[];
  provisionnings: string[];
  motifEchecs: string[];
};

export type InterventionImportBatch = {
  _id: string;
  originalName?: string;
  storedName?: string;
  storedPath?: string;
  fileSize?: number;
  status?: string;
  totals?: {
    total?: number;
    created?: number;
    versioned?: number;
    rejected?: number;
    tickets?: number;
    success?: number;
    failure?: number;
  };
  createdAt?: string;
  importedAt?: string;
  importedBy?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
  };
  periodStart?: string;
  periodEnd?: string;
  isToday?: boolean;
};

export type InterventionImportTicket = {
  _id: string;
  type?: string;
  numInter?: string;
  techFirstName?: string;
  techLastName?: string;
  techFull?: string;
  rawData?: Record<string, unknown> | null;
  reason?: string;
  status?: string;
  correctedCode?: string;
  correctedLabel?: string;
  resolvedAt?: string;
  resolutionType?: string;
  importBatchId?: {
    _id?: string;
    originalName?: string;
    storedName?: string;
    storedPath?: string;
    createdAt?: string;
  };
  createdAt?: string;
};

export type InterventionImportListResponse = {
  total: number;
  page: number;
  limit: number;
  items: InterventionImportBatch[];
};

export type InterventionImportTicketResponse = {
  total: number;
  page: number;
  limit: number;
  items: InterventionImportTicket[];
};

export type InterventionImportCategory = 'success' | 'failure' | 'versioned' | 'rejected' | 'tickets';

export type InterventionImportCategoryItem = {
  numInter?: string;
  techFull?: string;
  statut?: string;
  articles?: string;
  reason?: string;
  versionIndex?: number;
  createdAt?: string;
};

export type InterventionImportCategoryResponse = {
  total: number;
  page: number;
  limit: number;
  category: InterventionImportCategory;
  importBatchId?: string;
  items: InterventionImportCategoryItem[];
};

export type InterventionImportSummaryQuery = {
  importBatchId?: string;
  fromDate?: string;
  toDate?: string;
};

export type InterventionImportTechnicianSummary = {
  totals: InterventionTotals;
  total: number;
  totalAmount?: number;
  referenceDate?: string | null;
};

export type InterventionInvoiceItem = {
  code: string;
  label?: string;
  unitPrice?: number;
  quantity: number;
  total: number;
};

export type InterventionInvoiceDoc = {
  _id: string;
  attachmentRef: string;
  periodLabel: string;
  periodKey: string;
  totalHt: number;
  filename?: string;
};

export type InterventionInvoiceDetail = InterventionInvoiceDoc & {
  contractNo?: string;
  orderNo?: string;
  agencyRegion?: string;
  plaqueType?: string;
  importedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  items: Array<InterventionInvoiceItem & { unit?: string }>;
};

export type InterventionInvoiceSummary = {
  totalHt: number;
  byCode: Record<string, InterventionInvoiceItem>;
  invoices: InterventionInvoiceDoc[];
};

export type InterventionCompareRow = {
  code: string;
  osirisQty: number;
  invoiceQty: number;
  deltaQty: number;
  osirisAmount: number;
  invoiceAmount: number;
  deltaAmount: number;
  unitPrice: number;
};

export type InterventionCompare = {
  osiris: { totalAmount: number; byCode: Record<string, { code: string; quantity: number }> };
  invoice: { totalAmount: number; byCode: Record<string, InterventionInvoiceItem> };
  rows: InterventionCompareRow[];
};

export type AuditEchecItem = {
  technician: string;
  technicienId: string | null;
  region: string;
  societe: string;
  nbTotal: number;
  nbRacc: number;
  nbSav: number;
  nbRaccEchec: number;
  nbSavEchec: number;
  txEchecRacc: number;
  txEchecSav: number;
  txEchecGlobal: number;
  echecs: AuditEchecDetail[];
};

export type AuditEchecDetail = {
  numInter: string;
  dateRdv?: string | null;
  type: string;
  statut: string;
  motifEchec: string;
  client: string;
  region: string;
  commentairesTechnicien: string;
};

export type AuditTopMotif = { motif: string; count: number };

export type AuditEchecResponse = {
  items: AuditEchecItem[];
  topMotifs: AuditTopMotif[];
  totals: { nbTotal: number; nbEchecs: number; txEchecGlobal: number };
};

export type AuditEchecQuery = {
  fromDate?: string;
  toDate?: string;
  region?: string;
  societe?: string;
  technician?: string;
};

// ── Pipeline import types ─────────────────────────────────────────────────────

export type ImportPreviewDecisions = {
  create: number;
  version: number;
  skip: number;
  ticket: number;
};

export type ImportPreviewSummary = {
  totalLines: number;
  validLines: number;
  blockedLines: number;
  decisions: ImportPreviewDecisions;
  referentials: { created: { group: string; label: string }[]; total: number };
  unknownPrestations: { code: string; count: number }[];
  unknownTechnicians: { name: string; count: number }[];
  missingColumns: string[];
  detectedPeriod: { start: string | null; end: string | null };
};

export type ImportPipelineResult = {
  batchId: string;
  preview: ImportPreviewSummary;
  status: string;
};

export type ImportBatchDetail = {
  _id: string;
  originalName?: string;
  storedPath?: string;
  fileSize?: number;
  fileHash?: string;
  status: string;
  detectedEncoding?: string;
  detectedDelimiter?: string;
  previewSummary?: ImportPreviewSummary;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdAt?: string;
  importedBy?: { _id?: string; firstName?: string; lastName?: string };
};

export type ImportCommitResult = {
  total: number;
  created: number;
  versioned: number;
  skipped: number;
  ticketed: number;
  success: number;
  failure: number;
  batchId: string;
};

export type ImportRowItem = {
  _id: string;
  numInter?: string;
  techFull?: string;
  statut?: string;
  articles?: string;
  reason?: string;
  decision?: string;
  decisionReason?: string;
  issues?: { code: string; message: string; severity: string }[];
};

// ─────────────────────────────────────────────────────────────────────────────

export type InterventionSummaryQuery = {
  fromDate?: string;
  toDate?: string;
  fromDateCloture?: string;
  toDateCloture?: string;
  technician?: string;
  region?: string;
  client?: string;
  societe?: string;
  plaque?: string;
  ville?: string;
  rue?: string;
  codePostal?: string;
  idra?: string;
  idImmeuble?: string;
  numInter?: string;
  commandeId?: string;
  numAbonne?: string;
  abonne?: string;
  raisonSociale?: string;
  sct?: string;
  nomSro?: string;
  prise?: string;
  codeSec?: string;
  status?: string;
  type?: string;
  gestionnaire?: string;
  marque?: string;
  typeOffre?: string;
  typePon?: string;
  provisionning?: string;
  activite?: string;
  parcours?: string;
  multiSav?: string;
  gem?: string;
  statutBox4g?: string;
  transfoCable?: string;
  checkVoisin?: string;
  recoRacc?: string;
  equipement?: string;
  regroupSav?: string;
  categorieRdv?: string;
  flagBot?: string;
  creneau?: string;
  motifEchec?: string;
  commNc?: string;
  noteHotline?: string;
  rapportTech?: string;
  page?: number;
  limit?: number;
};

export type InterventionImportQuery = {
  page?: number;
  limit?: number;
};

export type InterventionImportTicketQuery = {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  importBatchId?: string;
};

@Injectable({ providedIn: 'root' })
export class InterventionService {
  private baseUrl = `${environment.apiBaseUrl}/interventions`;

  constructor(private http: HttpClient) {}

  importCsv(file: File, options: { overwrite?: boolean } = {}): Observable<{ success: boolean; data?: unknown; message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (options.overwrite) {
      formData.append('overwrite', 'true');
    }
    return this.http.post<{ success: boolean; data?: unknown; message?: string }>(`${this.baseUrl}/import`, formData);
  }

  summary(query: InterventionSummaryQuery = {}): Observable<{ success: boolean; data: InterventionSummaryResponse }> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.numInter) params = params.set('numInter', query.numInter);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    params = params.set('_ts', String(Date.now()));

    return this.http.get<{ success: boolean; data: InterventionSummaryResponse }>(`${this.baseUrl}/summary`, {
      params,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
    });
  }

  exportCsv(query: InterventionSummaryQuery = {}): Observable<Blob> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.numInter) params = params.set('numInter', query.numInter);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    return this.http.get(`${this.baseUrl}/export/csv`, { params, responseType: 'blob' });
  }

  exportPdf(query: InterventionSummaryQuery = {}): Observable<Blob> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.numInter) params = params.set('numInter', query.numInter);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    return this.http.get(`${this.baseUrl}/export/pdf`, { params, responseType: 'blob' });
  }

  list(query: InterventionSummaryQuery = {}): Observable<{ success: boolean; data: InterventionListResponse }> {
    let params = new HttpParams();
    const setParam = (k: string, v: string | number | undefined) => { if (v) params = params.set(k, String(v)); };
    setParam('fromDate', query.fromDate);
    setParam('toDate', query.toDate);
    setParam('fromDateCloture', query.fromDateCloture);
    setParam('toDateCloture', query.toDateCloture);
    setParam('technician', query.technician);
    setParam('region', query.region);
    setParam('client', query.client);
    setParam('societe', query.societe);
    setParam('plaque', query.plaque);
    setParam('ville', query.ville);
    setParam('rue', query.rue);
    setParam('codePostal', query.codePostal);
    setParam('idra', query.idra);
    setParam('idImmeuble', query.idImmeuble);
    setParam('numInter', query.numInter);
    setParam('commandeId', query.commandeId);
    setParam('numAbonne', query.numAbonne);
    setParam('abonne', query.abonne);
    setParam('raisonSociale', query.raisonSociale);
    setParam('sct', query.sct);
    setParam('nomSro', query.nomSro);
    setParam('prise', query.prise);
    setParam('codeSec', query.codeSec);
    setParam('status', query.status);
    setParam('type', query.type);
    setParam('gestionnaire', query.gestionnaire);
    setParam('marque', query.marque);
    setParam('typeOffre', query.typeOffre);
    setParam('typePon', query.typePon);
    setParam('provisionning', query.provisionning);
    setParam('activite', query.activite);
    setParam('parcours', query.parcours);
    setParam('multiSav', query.multiSav);
    setParam('gem', query.gem);
    setParam('statutBox4g', query.statutBox4g);
    setParam('transfoCable', query.transfoCable);
    setParam('checkVoisin', query.checkVoisin);
    setParam('recoRacc', query.recoRacc);
    setParam('equipement', query.equipement);
    setParam('regroupSav', query.regroupSav);
    setParam('categorieRdv', query.categorieRdv);
    setParam('flagBot', query.flagBot);
    setParam('creneau', query.creneau);
    setParam('motifEchec', query.motifEchec);
    setParam('commNc', query.commNc);
    setParam('noteHotline', query.noteHotline);
    setParam('rapportTech', query.rapportTech);
    setParam('page', query.page);
    setParam('limit', query.limit);

    return this.http.get<{ success: boolean; data: InterventionListResponse }>(`${this.baseUrl}/list`, { params });
  }

  filters(): Observable<{ success: boolean; data: InterventionFilters }> {
    return this.http.get<{ success: boolean; data: InterventionFilters }>(`${this.baseUrl}/filters`);
  }

  listImports(query: InterventionImportQuery = {}): Observable<{ success: boolean; data: InterventionImportListResponse }> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    return this.http.get<{ success: boolean; data: InterventionImportListResponse }>(`${this.baseUrl}/imports`, { params });
  }

  listImportsTechnician(query: InterventionImportQuery = {}): Observable<{ success: boolean; data: InterventionImportListResponse }> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    return this.http.get<{ success: boolean; data: InterventionImportListResponse }>(
      `${this.baseUrl}/imports/technician`,
      { params }
    );
  }

  importSummaryTechnician(
    query: InterventionImportSummaryQuery = {}
  ): Observable<{ success: boolean; data: InterventionImportTechnicianSummary }> {
    let params = new HttpParams();
    if (query.importBatchId) params = params.set('importBatchId', query.importBatchId);
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    return this.http.get<{ success: boolean; data: InterventionImportTechnicianSummary }>(
      `${this.baseUrl}/imports/technician/summary`,
      { params }
    );
  }

  downloadImport(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/imports/${id}/download`, { responseType: 'blob' });
  }

  getBpuAnalysis(id: string): Observable<{ success: boolean; data: BpuAnalysisReport | null; message?: string }> {
    return this.http.get<{ success: boolean; data: BpuAnalysisReport | null; message?: string }>(
      `${this.baseUrl}/imports/${id}/bpu-analysis`
    );
  }

  listImportTickets(
    query: InterventionImportTicketQuery = {}
  ): Observable<{ success: boolean; data: InterventionImportTicketResponse }> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    if (query.importBatchId) params = params.set('importBatchId', query.importBatchId);
    return this.http.get<{ success: boolean; data: InterventionImportTicketResponse }>(
      `${this.baseUrl}/import-tickets`,
      { params }
    );
  }

  resolveImportTicket(ticketId: string, payload: { code: string; label?: string }) {
    return this.http.patch<{ success: boolean; data: InterventionImportTicket }>(
      `${this.baseUrl}/import-tickets/${ticketId}/resolve`,
      payload
    );
  }

  resolveImportTicketAuto(ticketId: string) {
    return this.http.post<{ success: boolean; data: InterventionImportTicket }>(
      `${this.baseUrl}/import-tickets/${ticketId}/resolve-auto`,
      {}
    );
  }

  reprocessImportTicket(ticketId: string) {
    return this.http.post<{ success: boolean; data: { action: string; numInter: string } }>(
      `${this.baseUrl}/import-tickets/${ticketId}/reprocess`,
      {}
    );
  }

  listImportCategory(query: {
    category: InterventionImportCategory;
    importBatchId?: string;
    page?: number;
    limit?: number;
  }): Observable<{ success: boolean; data: InterventionImportCategoryResponse }> {
    let params = new HttpParams().set('category', query.category);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    if (query.importBatchId) params = params.set('importBatchId', query.importBatchId);
    return this.http.get<{ success: boolean; data: InterventionImportCategoryResponse }>(
      `${this.baseUrl}/imports/category`,
      { params }
    );
  }

  listImportTicketsTechnician(
    query: InterventionImportTicketQuery = {}
  ): Observable<{ success: boolean; data: InterventionImportTicketResponse }> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    if (query.importBatchId) params = params.set('importBatchId', query.importBatchId);
    return this.http.get<{ success: boolean; data: InterventionImportTicketResponse }>(
      `${this.baseUrl}/import-tickets/technician`,
      { params }
    );
  }

  auditEchecs(query: AuditEchecQuery = {}): Observable<{ success: boolean; data: AuditEchecResponse }> {
    let params = new HttpParams();
    if (query.fromDate)   params = params.set('fromDate', query.fromDate);
    if (query.toDate)     params = params.set('toDate', query.toDate);
    if (query.region)     params = params.set('region', query.region);
    if (query.societe)    params = params.set('societe', query.societe);
    if (query.technician) params = params.set('technician', query.technician);
    return this.http.get<{ success: boolean; data: AuditEchecResponse }>(
      `${this.baseUrl}/audit`, { params }
    );
  }

  auditEchecsCsv(file: File): Observable<{ success: boolean; data: AuditEchecResponse & { meta?: { filename: string; rowsRead: number } } }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; data: AuditEchecResponse & { meta?: { filename: string; rowsRead: number } } }>(
      `${this.baseUrl}/audit-csv`, formData
    );
  }

  resetAll(): Observable<{ success: boolean; data: { deleted: number } }> {
    return this.http.delete<{ success: boolean; data: { deleted: number } }>(`${this.baseUrl}/reset`);
  }

  formatVersions(): Observable<{ success: boolean; data: { backfilled: number; skipped: number } }> {
    return this.http.post<{ success: boolean; data: { backfilled: number; skipped: number } }>(
      `${this.baseUrl}/format-versions`,
      {}
    );
  }

  importInvoices(files: File[]): Observable<{ success: boolean; data?: unknown; message?: string }> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    return this.http.post<{ success: boolean; data?: unknown; message?: string }>(
      `${this.baseUrl}/invoices/import`,
      formData
    );
  }

  invoiceSummary(periodKey?: string): Observable<{ success: boolean; data: InterventionInvoiceSummary }> {
    let params = new HttpParams();
    if (periodKey) params = params.set('periodKey', periodKey);
    return this.http.get<{ success: boolean; data: InterventionInvoiceSummary }>(
      `${this.baseUrl}/invoices/summary`,
      { params }
    );
  }

  invoiceList(query: { periodKey?: string; attachmentRef?: string } = {}): Observable<{ success: boolean; data: InterventionInvoiceDetail[] }> {
    let params = new HttpParams();
    if (query.periodKey) params = params.set('periodKey', query.periodKey);
    if (query.attachmentRef) params = params.set('attachmentRef', query.attachmentRef);
    return this.http.get<{ success: boolean; data: InterventionInvoiceDetail[] }>(
      `${this.baseUrl}/invoices`,
      { params }
    );
  }

  resetInvoices(): Observable<{ success: boolean; data: { deleted: number } }> {
    return this.http.delete<{ success: boolean; data: { deleted: number } }>(`${this.baseUrl}/invoices/reset`, {
      headers: new HttpHeaders({
        'X-Confirm-Destructive': 'yes'
      })
    });
  }

  // ── Pipeline import (analyze / preview / commit) ──────────────────────────

  analyzeImport(file: File, overwrite = false): Observable<{ success: boolean; data: ImportPipelineResult }> {
    const formData = new FormData();
    formData.append('file', file);
    if (overwrite) formData.append('overwrite', 'true');
    return this.http.post<{ success: boolean; data: ImportPipelineResult }>(
      `${this.baseUrl}/imports/analyze`,
      formData
    );
  }

  getImportPreview(batchId: string): Observable<{ success: boolean; data: ImportBatchDetail }> {
    return this.http.get<{ success: boolean; data: ImportBatchDetail }>(
      `${this.baseUrl}/imports/${batchId}/preview`
    );
  }

  commitImport(batchId: string): Observable<{ success: boolean; data: ImportCommitResult }> {
    return this.http.post<{ success: boolean; data: ImportCommitResult }>(
      `${this.baseUrl}/imports/${batchId}/commit`,
      {}
    );
  }

  listImportItems(batchId: string, query: { category?: string; decision?: string; page?: number; limit?: number } = {}) {
    let params = new HttpParams();
    if (query.category) params = params.set('category', query.category);
    if (query.decision)  params = params.set('decision', query.decision);
    if (query.page)      params = params.set('page', String(query.page));
    if (query.limit)     params = params.set('limit', String(query.limit));
    return this.http.get<{ success: boolean; data: { items: ImportRowItem[]; total: number; page: number; limit: number } }>(
      `${this.baseUrl}/imports/${batchId}/items`, { params }
    );
  }

  listReferentials(groups?: string[]): Observable<{ success: boolean; data: Record<string, { label: string; key: string }[]> }> {
    let params = new HttpParams();
    if (groups?.length) params = params.set('groups', groups.join(','));
    return this.http.get<{ success: boolean; data: Record<string, { label: string; key: string }[]> }>(
      `${this.baseUrl}/referentials`, { params }
    );
  }

  compare(
    query: InterventionSummaryQuery & { periodKey?: string; invoiceIds?: string[] } = {}
  ): Observable<{ success: boolean; data: InterventionCompare }> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    if (query.periodKey) params = params.set('periodKey', query.periodKey);
    if (query.invoiceIds?.length) params = params.set('invoiceIds', query.invoiceIds.join(','));
    return this.http.get<{ success: boolean; data: InterventionCompare }>(`${this.baseUrl}/compare`, { params });
  }
}
