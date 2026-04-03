import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type OsirisCodeMapping = {
  _id: string;
  osirisCode: string;
  canonicalCode: string;
  label: string;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
  createdBy?: { name: string; email: string };
};

export type CreateMappingDto = {
  osirisCode: string;
  canonicalCode: string;
  label?: string;
  validFrom?: string | null;
  validTo?: string | null;
};

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class OsirisMappingService {
  private readonly baseUrl = `${environment.apiBaseUrl}/bpu/osiris-mappings`;

  constructor(private http: HttpClient) {}

  list(active?: boolean): Observable<OsirisCodeMapping[]> {
    const params: Record<string, string> = {};
    if (active !== undefined) params['active'] = String(active);
    return this.http
      .get<ApiResponse<OsirisCodeMapping[]>>(this.baseUrl, { params })
      .pipe(map((r) => r.data || []));
  }

  create(dto: CreateMappingDto): Observable<OsirisCodeMapping> {
    return this.http
      .post<ApiResponse<OsirisCodeMapping>>(this.baseUrl, dto)
      .pipe(map((r) => r.data));
  }

  update(id: string, dto: Partial<CreateMappingDto & { active: boolean }>): Observable<OsirisCodeMapping> {
    return this.http
      .put<ApiResponse<OsirisCodeMapping>>(`${this.baseUrl}/${id}`, dto)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<OsirisCodeMapping> {
    return this.http
      .patch<ApiResponse<OsirisCodeMapping>>(`${this.baseUrl}/${id}/deactivate`, {})
      .pipe(map((r) => r.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
