import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Absence, AbsenceStatus } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class AbsenceService {
  private readonly baseUrl = `${environment.apiBaseUrl}/absences`;

  constructor(private http: HttpClient) {}

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
