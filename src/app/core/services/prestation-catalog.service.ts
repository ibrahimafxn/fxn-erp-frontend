import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PrestationCatalog, PrestationCatalogListResult, PrestationSegment } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export type PrestationCatalogFilter = {
  q?: string;
  page?: number;
  limit?: number;
  segment?: PrestationSegment;
  active?: boolean;
};

export type PrestationCatalogPayload = {
  code: string;
  libelle: string;
  segment: PrestationSegment;
  famille?: string | null;
  unite?: string | null;
  prixUnitaireBase: number;
  active?: boolean;
  visiblePourSaisie?: boolean;
  compteDansCa?: boolean;
  compteDansAttachement?: boolean;
  coefficientCa?: number;
  coefficientAttachement?: number;
  ordreAffichage?: number;
  dateEffet?: string | null;
};

@Injectable({ providedIn: 'root' })
export class PrestationCatalogService {
  private readonly baseUrl = `${environment.apiBaseUrl}/prestations-catalog`;

  constructor(private http: HttpClient) {}

  list(filter?: PrestationCatalogFilter): Observable<PrestationCatalogListResult> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));
    if (filter?.segment) params = params.set('segment', filter.segment);
    if (typeof filter?.active === 'boolean') params = params.set('active', String(filter.active));
    return this.http.get<ApiResponse<PrestationCatalogListResult>>(this.baseUrl, { params }).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  get(id: string): Observable<PrestationCatalog> {
    return this.http.get<ApiResponse<PrestationCatalog>>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  create(payload: PrestationCatalogPayload): Observable<PrestationCatalog> {
    return this.http.post<ApiResponse<PrestationCatalog>>(this.baseUrl, payload).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  update(id: string, payload: Partial<PrestationCatalogPayload>): Observable<PrestationCatalog> {
    return this.http.put<ApiResponse<PrestationCatalog>>(`${this.baseUrl}/${id}`, payload).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  updateStatus(id: string, active: boolean): Observable<PrestationCatalog> {
    return this.http.patch<ApiResponse<PrestationCatalog>>(`${this.baseUrl}/${id}/status`, { active }).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }
}
