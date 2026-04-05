import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';

export type AuditLogItem = {
  _id: string;
  createdAt: string;
  user?: { _id: string; firstName?: string; lastName?: string; email?: string; role?: string } | null;
  role?: string | null;
  method: string;
  path: string;
  status: number;
  ip?: string | null;
  userAgent?: string | null;
  durationMs?: number | null;
  bodyKeys?: string[];
  queryKeys?: string[];
  paramsKeys?: string[];
  requestId?: string | null;
};

export type AuditLogResult = {
  total: number;
  page: number;
  limit: number;
  items: AuditLogItem[];
};

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private baseUrl = `${environment.apiBaseUrl}/admin/audit-logs`;

  constructor(private http: HttpClient) {}

  list(filter?: { user?: string; from?: string; to?: string; methods?: string; page?: number; limit?: number }) {
    let params = new HttpParams();
    if (filter?.user) params = params.set('user', filter.user);
    if (filter?.from) params = params.set('from', filter.from);
    if (filter?.to) params = params.set('to', filter.to);
    if (filter?.methods) params = params.set('methods', filter.methods);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));

    return this.http
      .get<{ success: boolean; data: AuditLogResult }>(this.baseUrl, { params })
      .pipe(map(resp => resp.data));
  }
}
