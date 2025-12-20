import { Injectable, signal, Signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { DepotListResult } from '../models/depot-list-result.model';
import { Depot } from '../models';
import {DepotStats} from '../models/depotStats.model';

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: any };

@Injectable({ providedIn: 'root' })
export class DepotService {
  private apiBase = environment.apiBaseUrl;
  private baseUrl = `${this.apiBase}/depots`;

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<any | null>(null);
  readonly error: Signal<any | null> = this._error.asReadonly();

  private _result = signal<DepotListResult | null>(null);
  readonly result: Signal<DepotListResult | null> = this._result.asReadonly();

  /** Cache par “clé de requête” (q/page/limit) */
  private _cache = new Map<string, Observable<DepotListResult>>();

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

  refreshDepots(
    force = false,
    filter?: { q?: string; page?: number; limit?: number }
  ): Observable<DepotListResult> {
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

    const req$ = this.http.get<ApiResponse<DepotListResult>>(this.baseUrl, { params }).pipe(
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

  /** GET dépôt (utile pour depot-form en édition) */
  /** ✅ Détail dépôt */
  getDepot(id: string): Observable<Depot> {
    this._loading.set(true);
    this._error.set(null);

    return this.http.get<ApiResponse<Depot>>(`${this.baseUrl}/${id}`).pipe(
      map(resp => resp.data),
      tap(() => this._loading.set(false)),
      catchError(err => this.handleError(err))
    );
  }

  createDepot(payload: Partial<Depot>) {
    this.clearCache();
    return this.http.post<ApiResponse<Depot>>(this.baseUrl, payload);
  }

  updateDepot(id: string, payload: Partial<Depot>) {
    this.clearCache();
    return this.http.put<ApiResponse<Depot>>(`${this.baseUrl}/${id}`, payload);
  }

  deleteDepot(id: string) {
    this.clearCache();
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}`);
  }

// Assigner (ou retirer) un gestionnaire de dépôt
// managerId = string | null :
// - string => affecter un user (GESTION_DEPOT)
// - null   => retirer le gestionnaire
  assignManager(depotId: string, managerId: string | null) {
    return this.http
      .post<ApiResponse<Depot>>(`${this.baseUrl}/${depotId}/assign-manager`, { managerId })
      .pipe(
        map(resp => resp.data),
        tap(() => this.clearCache())
      );
  }

  // get depot stats
  getDepotStats(depotId: string) {
    return this.http.get<ApiResponse<DepotStats>>(`${this.baseUrl}/${depotId}/stats`).pipe(
      map(r => r.data)
    );
  }
}
