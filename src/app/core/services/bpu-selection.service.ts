import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BpuSelection, BpuPriceHistory } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class BpuSelectionService {
  private readonly baseUrl = `${environment.apiBaseUrl}/bpu/selections`;

  constructor(private http: HttpClient) {}

  create(payload: { type: string; prestations: { code: string; unitPrice: number }[]; owner?: string | null; validFrom?: string }): Observable<BpuSelection> {
    return this.http.post<ApiResponse<BpuSelection>>(this.baseUrl, payload).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  list(params?: { owner?: string | null }): Observable<BpuSelection[]> {
    let httpParams = new HttpParams();
    if (params && 'owner' in params) {
      httpParams = httpParams.set('owner', params.owner ?? 'null');
    }
    return this.http.get<ApiResponse<BpuSelection[]>>(this.baseUrl, { params: httpParams }).pipe(
      map((resp) => resp.data || []),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  /**
   * Retourne tous les snapshots historiques de prix pour un owner donné,
   * triés du plus récent au plus ancien.
   */
  listHistory(params?: { owner?: string | null }): Observable<BpuPriceHistory[]> {
    let httpParams = new HttpParams();
    if (params && 'owner' in params) {
      httpParams = httpParams.set('owner', params.owner ?? 'null');
    }
    return this.http
      .get<ApiResponse<BpuPriceHistory[]>>(`${environment.apiBaseUrl}/bpu/price-history`, { params: httpParams })
      .pipe(
        map((resp) => resp.data || []),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<{ id: string }>>(`${this.baseUrl}/${id}`).pipe(
      map(() => void 0),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  updateHistory(id: string, prestations: { code: string; unitPrice: number }[]): Observable<BpuPriceHistory> {
    return this.http
      .patch<ApiResponse<BpuPriceHistory>>(`${environment.apiBaseUrl}/bpu/price-history/${id}`, { prestations })
      .pipe(
        map((resp) => resp.data),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }

  deleteHistory(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<{ id: string }>>(`${environment.apiBaseUrl}/bpu/price-history/${id}`)
      .pipe(
        map(() => void 0),
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
  }
}
