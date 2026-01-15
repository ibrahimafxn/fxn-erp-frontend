import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {catchError, map, of} from 'rxjs';
import {environment} from '../../environments/environment';
import {
  ComplianceResult,
  DocAlertsSummary,
  EmployeeDoc,
  EmployeeListResult,
  EmployeeProfile,
  EmployeeSummary,
  HrHistoryResult,
  HrRequirements,
  LeaveRequest
} from '../models';

const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class HrService {
  constructor(private http: HttpClient) {}

  listEmployees(filter?: { depot?: string; role?: string; q?: string; page?: number; limit?: number }) {
    let params = new HttpParams();
    if (filter?.depot) params = params.set('depot', filter.depot);
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));
    return this.http.get<{ success: boolean; data: EmployeeListResult | EmployeeSummary[] }>(`${API_BASE}/hr/employees`, { params })
      .pipe(map(resp => {
        const data = resp.data as any;
        if (Array.isArray(data)) {
          return { total: data.length, page: 1, limit: data.length, items: data } as EmployeeListResult;
        }
        return data as EmployeeListResult;
      }));
  }

  getEmployee(userId: string) {
    return this.http.get<{ success: boolean; data: EmployeeSummary }>(`${API_BASE}/hr/employees/${userId}`)
      .pipe(map(resp => resp.data));
  }

  getCompliance(userId: string) {
    return this.http.get<{ success: boolean; data: ComplianceResult }>(`${API_BASE}/hr/employees/${userId}/compliance`)
      .pipe(map(resp => resp.data));
  }

  getRequirements() {
    return this.http.get<{ success: boolean; data: HrRequirements }>(`${API_BASE}/hr/requirements`)
      .pipe(map(resp => resp.data));
  }

  upsertProfile(userId: string, payload: Partial<EmployeeProfile>) {
    return this.http.put<{ success: boolean; data: EmployeeProfile }>(`${API_BASE}/hr/employees/${userId}/profile`, payload)
      .pipe(map(resp => resp.data));
  }

  addDocument(payload: Partial<EmployeeDoc> | FormData) {
    return this.http.post<{ success: boolean; data: EmployeeDoc }>(`${API_BASE}/hr/docs`, payload)
      .pipe(map(resp => resp.data));
  }

  listDocs(filter?: { user?: string }) {
    const url = `${API_BASE}/hr/docs`;
    const options = filter ? { params: filter as any } : {};
    return this.http.get<{ success: boolean; data: EmployeeDoc[] }>(url, options).pipe(
      map(resp => resp.data),
      catchError(err => {
        console.error('listDocs error', err);
        return of([]);
      })
    );
  }

  listDocAlerts(days = 30) {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<{ success: boolean; data: DocAlertsSummary }>(`${API_BASE}/hr/docs/alerts`, { params })
      .pipe(map(resp => resp.data));
  }

  listHistory(filter?: { user?: string; page?: number; limit?: number }) {
    let params = new HttpParams();
    if (filter?.user) params = params.set('user', filter.user);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));
    return this.http.get<{ success: boolean; data: HrHistoryResult }>(`${API_BASE}/hr/history`, { params })
      .pipe(map(resp => resp.data));
  }

  deleteDoc(id: string) {
    return this.http.delete<{ success: boolean }>(`${API_BASE}/hr/docs/${id}`);
  }

  checkUserCompliance(userId: string, requiredTypes: string[] = []) {
    return this.http.post<{ success: boolean; data: ComplianceResult }>(`${API_BASE}/hr/check-compliance`, { userId, requiredTypes })
      .pipe(map(resp => resp.data));
  }

  listLeaves(filter?: { user?: string; status?: string }) {
    let params = new HttpParams();
    if (filter?.user) params = params.set('user', filter.user);
    if (filter?.status) params = params.set('status', filter.status);
    return this.http.get<{ success: boolean; data: LeaveRequest[] }>(`${API_BASE}/hr/leaves`, { params })
      .pipe(map(resp => resp.data));
  }

  createLeave(payload: Partial<LeaveRequest>) {
    return this.http.post<{ success: boolean; data: LeaveRequest }>(`${API_BASE}/hr/leaves`, payload)
      .pipe(map(resp => resp.data));
  }

  decideLeave(id: string, status: 'APPROVED' | 'REJECTED', note = '') {
    return this.http.patch<{ success: boolean; data: LeaveRequest }>(`${API_BASE}/hr/leaves/${id}/decision`, { status, note })
      .pipe(map(resp => resp.data));
  }

  cancelLeave(id: string, note = '') {
    return this.http.patch<{ success: boolean; data: LeaveRequest }>(`${API_BASE}/hr/leaves/${id}/cancel`, { note })
      .pipe(map(resp => resp.data));
  }
}
