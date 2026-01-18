import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type InterventionSummaryItem = {
  technician: string;
  total: number;
  racPavillon: number;
  racImmeuble: number;
  reconnexion: number;
  racF8: number;
  racProS: number;
  racProC?: number;
  sav: number;
  clem: number;
  deprise?: number;
  demo?: number;
  refrac?: number;
  refcDgr?: number;
  savExp?: number;
  cablePav1: number;
  cablePav2: number;
  cablePav3: number;
  cablePav4: number;
  racAutre: number;
  other: number;
};

export type InterventionTotals = {
  total: number;
  racPavillon: number;
  racImmeuble: number;
  reconnexion: number;
  racF8: number;
  racProS: number;
  racProC?: number;
  sav: number;
  clem: number;
  deprise?: number;
  demo?: number;
  refrac?: number;
  refcDgr?: number;
  savExp?: number;
  cablePav1: number;
  cablePav2: number;
  cablePav3: number;
  cablePav4: number;
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
  articlesRaw?: string;
  categories?: string[];
  importedAt?: string;
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
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
};

@Injectable({ providedIn: 'root' })
export class InterventionService {
  private baseUrl = `${environment.apiBaseUrl}/interventions`;

  constructor(private http: HttpClient) {}

  importCsv(file: File): Observable<{ success: boolean; data?: unknown; message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ success: boolean; data?: unknown; message?: string }>(`${this.baseUrl}/import`, formData);
  }

  summary(query: InterventionSummaryQuery = {}): Observable<{ success: boolean; data: InterventionSummaryResponse }> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));

    return this.http.get<{ success: boolean; data: InterventionSummaryResponse }>(`${this.baseUrl}/summary`, { params });
  }

  list(query: InterventionSummaryQuery = {}): Observable<{ success: boolean; data: InterventionListResponse }> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    if (query.page) params = params.set('page', String(query.page));
    if (query.limit) params = params.set('limit', String(query.limit));

    return this.http.get<{ success: boolean; data: InterventionListResponse }>(`${this.baseUrl}/list`, { params });
  }

  filters(): Observable<{ success: boolean; data: InterventionFilters }> {
    return this.http.get<{ success: boolean; data: InterventionFilters }>(`${this.baseUrl}/filters`);
  }

  resetAll(): Observable<{ success: boolean; data: { deleted: number } }> {
    return this.http.delete<{ success: boolean; data: { deleted: number } }>(`${this.baseUrl}/reset`);
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

  compare(query: InterventionSummaryQuery & { periodKey?: string } = {}): Observable<{ success: boolean; data: InterventionCompare }> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);
    if (query.periodKey) params = params.set('periodKey', query.periodKey);
    return this.http.get<{ success: boolean; data: InterventionCompare }>(`${this.baseUrl}/compare`, { params });
  }
}
