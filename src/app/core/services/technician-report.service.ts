import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReportStatus } from '../models';

export type TechnicianReportPrestation = { code: string; qty: number };

export type TechnicianReportEntry = {
  prestationId?: string;
  code?: string;
  qty?: number;
  quantite?: number;
  codeSnapshot?: string;
  libelleSnapshot?: string;
  segmentSnapshot?: string;
  prixUnitaireSnapshot?: number;
  montantLigne?: number;
  compteDansCaSnapshot?: boolean;
  compteDansAttachementSnapshot?: boolean;
  coefficientCaSnapshot?: number;
  coefficientAttachementSnapshot?: number;
  totalCaLigne?: number;
  totalAttachementLigne?: number;
};

export type TechnicianReport = {
  _id: string;
  reportDate: string;
  amount?: number;
  totalCa?: number;
  totalAttachement?: number;
  interventionsCount?: number;
  prestations?: TechnicianReportPrestation[];
  entries?: TechnicianReportEntry[];
  comment?: string;
  status?: ReportStatus;
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

type CreatePayload = {
  date?: string;
  dateActivite?: string;
  interventionsCount?: number;
  prestations?: TechnicianReportPrestation[];
  entries?: Array<{ prestationId: string; quantite: number }>;
  comment?: string;
  commentaire?: string;
};

type UpdatePayload = {
  interventionsCount?: number;
  prestations?: TechnicianReportPrestation[];
  entries?: Array<{ prestationId: string; quantite: number }>;
  comment?: string;
  commentaire?: string;
  status?: ReportStatus;
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

  create(payload: CreatePayload): Observable<{ success: boolean; data: TechnicianReport }> {
    return this.http.post<{ success: boolean; data: TechnicianReport }>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdatePayload): Observable<{ success: boolean; data: TechnicianReport }> {
    return this.http.put<{ success: boolean; data: TechnicianReport }>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }

  summary(params?: {
    fromDate?: string;
    toDate?: string;
    technicianId?: string;
    depotId?: string;
  }): Observable<{ success: boolean; data: { totalAmount: number; count: number } }> {
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

  summaryByMonth(params?: {
    year?: number;
    technicianId?: string;
    depotId?: string;
  }): Observable<{ success: boolean; data: { year: number; months: { month: string; totalAmount: number }[] } }> {
    let httpParams = new HttpParams();
    if (params?.year) httpParams = httpParams.set('year', String(params.year));
    if (params?.technicianId) httpParams = httpParams.set('technician', params.technicianId);
    if (params?.depotId) httpParams = httpParams.set('depot', params.depotId);
    return this.http.get<{ success: boolean; data: { year: number; months: { month: string; totalAmount: number }[] } }>(
      `${this.baseUrl}/summary-by-month`,
      { params: httpParams }
    );
  }

  summaryPeriods(technicianId?: string, referenceDate = new Date()): Observable<{
    daily: { success: boolean; data: { totalAmount: number; count: number } };
    weekly: { success: boolean; data: { totalAmount: number; count: number } };
    monthly: { success: boolean; data: { totalAmount: number; count: number } };
  }> {
    const dayStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const weekStart = this.startOfWeek(dayStart);
    const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
    const toDate = this.formatDate(dayStart);

    return forkJoin({
      daily: this.summary({ fromDate: this.formatDate(dayStart), toDate, technicianId }),
      weekly: this.summary({ fromDate: this.formatDate(weekStart), toDate, technicianId }),
      monthly: this.summary({ fromDate: this.formatDate(monthStart), toDate, technicianId })
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfWeek(date: Date): Date {
    const day = (date.getDay() + 6) % 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
  }
}
