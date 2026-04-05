import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  total: number;
  racPavillon: number;
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
  dateRdv?: string | null;
  region?: string;
  plaque?: string;
  societe?: string;
  techFirstName?: string;
  techLastName?: string;
  techFull?: string;
  type?: string;
  client?: string;
  statut?: string;
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
  listePrestationsRaw?: string;
  recoRacc?: string;
  isSuccess?: boolean;
  isFailure?: boolean;
  versionIndex?: number;
  latestVersionId?: string;
  articlesRaw?: string;
  categories?: string[];
  importedAt?: string;
  osirisRaw?: Record<string, string>;
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
  statuses: string[];
  technicians: string[];
  types: string[];
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
  numInter?: string;
  techFirstName?: string;
  techLastName?: string;
  techFull?: string;
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

export type InterventionSummaryQuery = {
  fromDate?: string;
  toDate?: string;
  technician?: string;
  region?: string;
  client?: string;
  numInter?: string;
  status?: string;
  type?: string;
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
    if (query.importBatchId) params = params.set('importBatchId', query.importBatchId);
    return this.http.get<{ success: boolean; data: InterventionImportTicketResponse }>(
      `${this.baseUrl}/import-tickets/technician`,
      { params }
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

  resetInvoices(): Observable<{ success: boolean; data: { deleted: number } }> {
    return this.http.delete<{ success: boolean; data: { deleted: number } }>(`${this.baseUrl}/invoices/reset`);
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
