import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type RevenueItem = {
  _id: string;
  year: number;
  month: number;
  amountHt: number;
  penalty?: number;
  note?: string;
  attachments?: RevenueAttachment[];
  createdBy?: RevenueUser | null;
  updatedBy?: RevenueUser | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type RevenueAttachment = {
  filename: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  uploadedAt?: string | Date;
};

export type RevenueUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
};

export type RevenueListResponse = {
  items: RevenueItem[];
  total: number;
  page?: number;
  limit?: number;
  totalCount?: number;
};

export type RevenueSummaryPoint = {
  key: string;
  year: number;
  month: number;
  amountHt: number;
  cumulativeHt: number;
  penalty?: number;
};

export type RevenueSummaryResponse = {
  series: RevenueSummaryPoint[];
  total: number;
};

export type RevenuePenaltyPreview = {
  penalty: number;
  amountHt?: number | null;
  note?: string | null;
  month?: number | null;
  year?: number | null;
};

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class RevenueService {
  private baseUrl = `${environment.apiBaseUrl}/revenue`;

  constructor(private http: HttpClient) {}

  list(filter?: { year?: number; month?: number; from?: string; to?: string; page?: number; limit?: number }): Observable<ApiResponse<RevenueListResponse>> {
    let params = new HttpParams();
    if (filter?.year) params = params.set('year', String(filter.year));
    if (filter?.month) params = params.set('month', String(filter.month));
    if (filter?.from) params = params.set('from', filter.from);
    if (filter?.to) params = params.set('to', filter.to);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));
    return this.http.get<ApiResponse<RevenueListResponse>>(this.baseUrl, { params });
  }

  summary(filter?: { year?: number; month?: number; from?: string; to?: string }): Observable<ApiResponse<RevenueSummaryResponse>> {
    let params = new HttpParams();
    if (filter?.year) params = params.set('year', String(filter.year));
    if (filter?.month) params = params.set('month', String(filter.month));
    if (filter?.from) params = params.set('from', filter.from);
    if (filter?.to) params = params.set('to', filter.to);
    return this.http.get<ApiResponse<RevenueSummaryResponse>>(`${this.baseUrl}/summary`, { params });
  }

  upsert(payload: { year: number; month: number; amountHt: number; penalty?: number; note?: string }) {
    return this.http.post<ApiResponse<RevenueItem>>(this.baseUrl, payload);
  }

  upsertWithAttachments(payload: { year: number; month: number; amountHt: number; penalty?: number; note?: string }, files: File[]) {
    const formData = new FormData();
    formData.append('year', String(payload.year));
    formData.append('month', String(payload.month));
    formData.append('amountHt', String(payload.amountHt));
    formData.append('penalty', String(payload.penalty ?? 0));
    if (typeof payload.note === 'string') {
      formData.append('note', payload.note);
    }
    for (const file of files) {
      formData.append('files', file);
    }
    return this.http.post<ApiResponse<RevenueItem>>(`${this.baseUrl}/attachments`, formData);
  }

  previewPenalty(files: File[], period?: { month?: number | string; year?: number | string }) {
    const formData = new FormData();
    if (period?.month) formData.append('month', String(period.month));
    if (period?.year) formData.append('year', String(period.year));
    for (const file of files) {
      formData.append('files', file);
    }
    return this.http.post<ApiResponse<RevenuePenaltyPreview>>(`${this.baseUrl}/attachments/penalty`, formData);
  }

  update(id: string, payload: { year: number; month: number; amountHt: number; penalty?: number; note?: string }) {
    return this.http.put<ApiResponse<RevenueItem>>(`${this.baseUrl}/${id}`, payload);
  }

  updateWithAttachments(id: string, payload: { year: number; month: number; amountHt: number; penalty?: number; note?: string }, files: File[]) {
    const formData = new FormData();
    formData.append('year', String(payload.year));
    formData.append('month', String(payload.month));
    formData.append('amountHt', String(payload.amountHt));
    formData.append('penalty', String(payload.penalty ?? 0));
    if (typeof payload.note === 'string') {
      formData.append('note', payload.note);
    }
    for (const file of files) {
      formData.append('files', file);
    }
    return this.http.put<ApiResponse<RevenueItem>>(`${this.baseUrl}/${id}/attachments`, formData);
  }

  removeAttachment(id: string, filename: string) {
    const encoded = encodeURIComponent(filename);
    return this.http.delete<ApiResponse<RevenueItem>>(`${this.baseUrl}/${id}/attachments/${encoded}`);
  }

  downloadAttachment(id: string, filename: string) {
    const encoded = encodeURIComponent(filename);
    return this.http.get(`${this.baseUrl}/${id}/attachments/${encoded}/download`, {
      responseType: 'blob'
    });
  }

  remove(id: string) {
    return this.http.delete<ApiResponse<RevenueItem>>(`${this.baseUrl}/${id}`);
  }
}
