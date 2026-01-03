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
  sav: number;
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
  sav: number;
  racAutre: number;
  other: number;
};

export type InterventionSummary = {
  items: InterventionSummaryItem[];
  totals: InterventionTotals;
};

export type InterventionFilters = {
  regions: string[];
  clients: string[];
  statuses: string[];
  technicians: string[];
  types: string[];
};

export type InterventionSummaryQuery = {
  fromDate?: string;
  toDate?: string;
  technician?: string;
  region?: string;
  client?: string;
  status?: string;
  type?: string;
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

  summary(query: InterventionSummaryQuery = {}): Observable<{ success: boolean; data: InterventionSummary }> {
    let params = new HttpParams();
    if (query.fromDate) params = params.set('fromDate', query.fromDate);
    if (query.toDate) params = params.set('toDate', query.toDate);
    if (query.technician) params = params.set('technician', query.technician);
    if (query.region) params = params.set('region', query.region);
    if (query.client) params = params.set('client', query.client);
    if (query.status) params = params.set('status', query.status);
    if (query.type) params = params.set('type', query.type);

    return this.http.get<{ success: boolean; data: InterventionSummary }>(`${this.baseUrl}/summary`, { params });
  }

  filters(): Observable<{ success: boolean; data: InterventionFilters }> {
    return this.http.get<{ success: boolean; data: InterventionFilters }>(`${this.baseUrl}/filters`);
  }
}
