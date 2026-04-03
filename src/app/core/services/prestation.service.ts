import { Injectable, signal, Signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Prestation, PrestationListResult } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: any };

@Injectable({ providedIn: 'root' })
export class PrestationService {
  private baseUrl = `${environment.apiBaseUrl}/prestations`;

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<any | null>(null);
  readonly error: Signal<any | null> = this._error.asReadonly();

  private _result = signal<PrestationListResult | null>(null);
  readonly result: Signal<PrestationListResult | null> = this._result.asReadonly();

  private _cache = new Map<string, Observable<PrestationListResult>>();

  constructor(private http: HttpClient) {}

  private handleError(err: any) {
    this._error.set(err);
    return throwError(() => err);
  }

  private buildKey(filter?: { q?: string; page?: number; limit?: number }): string {
    const q = filter?.q?.trim() || '';
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 25;
    return `q=${q}|page=${page}|limit=${limit}`;
  }

  refreshPrestations(
    force = false,
    filter?: { q?: string; page?: number; limit?: number }
  ): Observable<PrestationListResult> {
    const key = this.buildKey(filter);

    if (!force) {
      const cached = this._cache.get(key);
      if (cached) return cached;
    }

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));

    const req$ = this.http.get<ApiResponse<PrestationListResult>>(this.baseUrl, { params }).pipe(
      map(resp => resp.data),
      tap(result => this._result.set(result)),
      catchError(err => this.handleError(err)),
      finalize(() => this._loading.set(false)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._cache.set(key, req$);
    return req$;
  }

  clearCache(): void {
    this._cache.clear();
  }

  getPrestation(id: string): Observable<Prestation> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.get<ApiResponse<Prestation>>(`${this.baseUrl}/${id}`).pipe(
      map(resp => resp.data),
      tap(() => this._loading.set(false)),
      catchError(err => this.handleError(err))
    );
  }

  createPrestation(payload: Partial<Prestation>): Observable<ApiResponse<Prestation>> {
    this.clearCache();
    return this.http.post<ApiResponse<Prestation>>(this.baseUrl, payload);
  }

  updatePrestation(id: string, payload: Partial<Prestation>): Observable<ApiResponse<Prestation>> {
    this.clearCache();
    return this.http.put<ApiResponse<Prestation>>(`${this.baseUrl}/${id}`, payload);
  }

  deletePrestation(id: string): Observable<ApiResponse<any>> {
    this.clearCache();
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}`);
  }
}
