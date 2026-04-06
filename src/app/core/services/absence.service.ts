import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Absence, AbsenceHistoryItem, AbsenceStatus } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class AbsenceService {
  private readonly baseUrl = `${environment.apiBaseUrl}/absences`;

  private _pendingCount = signal(0);
  readonly pendingCount = this._pendingCount.asReadonly();

  constructor(private http: HttpClient) {}

  refreshPendingCount(): void {
    const params = new HttpParams().set('status', 'EN_ATTENTE');
    this.http.get<ApiResponse<Absence[]>>(this.baseUrl, { params }).subscribe({
      next: (res) => this._pendingCount.set(res?.data?.length ?? 0),
      error: () => this._pendingCount.set(0)
    });
  }

  list(params?: {
    fromDate?: string;
    toDate?: string;
    technicianId?: string;
    depotId?: string;
    status?: string;
    type?: string;
  }): Observable<ApiResponse<Absence[]>> {
    let httpParams = new HttpParams();
    if (params?.fromDate) httpParams = httpParams.set('from', params.fromDate);
    if (params?.toDate) httpParams = httpParams.set('to', params.toDate);
    if (params?.technicianId) httpParams = httpParams.set('technician', params.technicianId);
    if (params?.depotId) httpParams = httpParams.set('depot', params.depotId);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.type) httpParams = httpParams.set('type', params.type);
    return this.http.get<ApiResponse<Absence[]>>(this.baseUrl, { params: httpParams });
  }

  history(absenceId: string): Observable<ApiResponse<AbsenceHistoryItem[]>> {
    const httpParams = new HttpParams().set('absenceId', absenceId);
    return this.http.get<ApiResponse<AbsenceHistoryItem[]>>(`${this.baseUrl}/history`, { params: httpParams });
  }

  create(payload: Absence): Observable<ApiResponse<Absence>> {
    return this.http.post<ApiResponse<Absence>>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<Absence>): Observable<ApiResponse<Absence>> {
    return this.http.put<ApiResponse<Absence>>(`${this.baseUrl}/${id}`, payload);
  }

  updateStatus(id: string, status: AbsenceStatus): Observable<ApiResponse<Absence>> {
    return this.http.patch<ApiResponse<Absence>>(`${this.baseUrl}/${id}/status`, { status });
  }

  remove(id: string): Observable<ApiResponse<{ ok: boolean }>> {
    return this.http.delete<ApiResponse<{ ok: boolean }>>(`${this.baseUrl}/${id}`);
  }
}
