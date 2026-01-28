import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TechnicianReport = {
  _id: string;
  reportDate: string;
  amount?: number;
  interventionsCount?: number;
  prestations?: {
    professionnel?: number;
    pavillon?: number;
    immeuble?: number;
    racProC?: number;
    prestaComplementaire?: number;
    reconnexion?: number;
    sav?: number;
    prestationF8?: number;
  };
  comment?: string;
  technician?: { _id: string; firstName?: string; lastName?: string; email?: string };
  depot?: { _id: string; name?: string; city?: string };
  createdAt?: string;
  updatedAt?: string;
};

export type TechnicianReportList = {
  total: number;
  page: number;
  limit: number;
  items: TechnicianReport[];
};

@Injectable({ providedIn: 'root' })
export class TechnicianReportService {
  private baseUrl = `${environment.apiBaseUrl}/technician-reports`;

  constructor(private http: HttpClient) {}

  list(params?: {
    page?: number;
    limit?: number;
    month?: string;
    fromDate?: string;
    toDate?: string;
    technicianId?: string;
    depotId?: string;
  }): Observable<{ success: boolean; data: TechnicianReportList }> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.month) httpParams = httpParams.set('month', params.month);
    if (params?.fromDate) httpParams = httpParams.set('from', params.fromDate);
    if (params?.toDate) httpParams = httpParams.set('to', params.toDate);
    if (params?.technicianId) httpParams = httpParams.set('technician', params.technicianId);
    if (params?.depotId) httpParams = httpParams.set('depot', params.depotId);
    return this.http.get<{ success: boolean; data: TechnicianReportList }>(this.baseUrl, { params: httpParams });
  }

  create(payload: { date?: string; interventionsCount?: number; prestations?: TechnicianReport['prestations']; comment?: string }): Observable<{ success: boolean; data: TechnicianReport }> {
    return this.http.post<{ success: boolean; data: TechnicianReport }>(this.baseUrl, payload);
  }

  update(id: string, payload: { interventionsCount?: number; prestations?: TechnicianReport['prestations']; comment?: string }): Observable<{ success: boolean; data: TechnicianReport }> {
    return this.http.put<{ success: boolean; data: TechnicianReport }>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }

  summary(params?: { fromDate?: string; toDate?: string; technicianId?: string; depotId?: string }): Observable<{
    success: boolean;
    data: { totalAmount: number; count: number };
  }> {
    let httpParams = new HttpParams();
    if (params?.fromDate) httpParams = httpParams.set('from', params.fromDate);
    if (params?.toDate) httpParams = httpParams.set('to', params.toDate);
    if (params?.technicianId) httpParams = httpParams.set('technician', params.technicianId);
    if (params?.depotId) httpParams = httpParams.set('depot', params.depotId);
    return this.http.get<{ success: boolean; data: { totalAmount: number; count: number } }>(
      `${this.baseUrl}/summary`,
      { params: httpParams }
    );
  }
}
