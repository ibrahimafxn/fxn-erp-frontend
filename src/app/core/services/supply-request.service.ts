import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupplyRequest, SupplyRequestList, SupplyRequestStatus, SupplyRequestType } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: unknown };

@Injectable({ providedIn: 'root' })
export class SupplyRequestService {
  private baseUrl = `${environment.apiBaseUrl}/supply-requests`;

  constructor(private http: HttpClient) {}

  list(params?: {
    page?: number;
    limit?: number;
    status?: SupplyRequestStatus | '';
    resourceType?: SupplyRequestType | '';
    depotId?: string;
    technicianId?: string;
  }): Observable<ApiResponse<SupplyRequestList>> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.resourceType) httpParams = httpParams.set('resourceType', params.resourceType);
    if (params?.depotId) httpParams = httpParams.set('depot', params.depotId);
    if (params?.technicianId) httpParams = httpParams.set('technician', params.technicianId);
    return this.http.get<ApiResponse<SupplyRequestList>>(this.baseUrl, { params: httpParams });
  }

  listMine(params?: {
    page?: number;
    limit?: number;
    status?: SupplyRequestStatus | '';
    resourceType?: SupplyRequestType | '';
  }): Observable<ApiResponse<SupplyRequestList>> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.resourceType) httpParams = httpParams.set('resourceType', params.resourceType);
    return this.http.get<ApiResponse<SupplyRequestList>>(`${this.baseUrl}/my`, { params: httpParams });
  }

  summaryMine(): Observable<ApiResponse<{ pending: number; approved: number; canceled: number; decided: number; latestDecidedAt?: string | null }>> {
    return this.http.get<ApiResponse<{ pending: number; approved: number; canceled: number; decided: number; latestDecidedAt?: string | null }>>(
      `${this.baseUrl}/my/summary`
    );
  }

  create(payload: {
    resourceType: SupplyRequestType;
    resourceId: string;
    quantity: number;
    note?: string;
  }): Observable<ApiResponse<SupplyRequest>> {
    return this.http.post<ApiResponse<SupplyRequest>>(this.baseUrl, payload);
  }

  update(id: string, payload: {
    resourceType: SupplyRequestType;
    resourceId: string;
    quantity: number;
    note?: string;
  }): Observable<ApiResponse<SupplyRequest>> {
    return this.http.put<ApiResponse<SupplyRequest>>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<ApiResponse<{ _id: string }>> {
    return this.http.delete<ApiResponse<{ _id: string }>>(`${this.baseUrl}/${id}`);
  }

  decide(id: string, payload: { status: 'APPROVED' | 'CANCELED'; comment: string }): Observable<ApiResponse<SupplyRequest>> {
    return this.http.put<ApiResponse<SupplyRequest>>(`${this.baseUrl}/${id}/decision`, payload);
  }
}
