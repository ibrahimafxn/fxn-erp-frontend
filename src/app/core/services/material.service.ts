import { Injectable, Signal, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Material } from '../models';

export interface MaterialListResult {
  total: number;
  page: number;
  limit: number;
  items: Material[];
}

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: unknown };

export type MaterialFilter = {
  q?: string;
  depot?: string;
  page?: number;
  limit?: number;
};

@Injectable({ providedIn: 'root' })
export class MaterialService {
  private baseUrl = `${environment.apiBaseUrl}/materials`;

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<HttpErrorResponse | null>(null);
  readonly error: Signal<HttpErrorResponse | null> = this._error.asReadonly();

  private _result = signal<MaterialListResult | null>(null);
  readonly result: Signal<MaterialListResult | null> = this._result.asReadonly();

  private _request$?: Observable<MaterialListResult>;

  constructor(private http: HttpClient) {}

  private handleError(err: HttpErrorResponse) {
    this._error.set(err);
    this._loading.set(false);
    return throwError(() => err);
  }

  clearCache(): void {
    this._request$ = undefined;
  }

  /** Liste paginée + filtres */
  refresh(force = false, filter?: MaterialFilter): Observable<MaterialListResult> {
    if (!force && this._request$) return this._request$;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.depot) params = params.set('depot', filter.depot);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));

    const req$ = this.http.get<ApiResponse<MaterialListResult>>(this.baseUrl, { params }).pipe(
      map(resp => resp.data),
      tap(result => this._result.set(result)),
      tap(() => this._loading.set(false)),
      catchError(err => this.handleError(err))
    );

    // cache rx
    this._request$ = req$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
    return this._request$;
  }

  /** GET /materials/:id (enveloppe API) */
  getById(id: string): Observable<Material> {
    return this.http.get<ApiResponse<Material>>(`${this.baseUrl}/${id}`).pipe(
      map(resp => resp.data),
      catchError(err => this.handleError(err))
    );
  }

  /** POST /materials */
  create(payload: Partial<Material>): Observable<Material> {
    this.clearCache();
    return this.http.post<ApiResponse<Material>>(this.baseUrl, payload).pipe(
      map(resp => resp.data),
      catchError(err => this.handleError(err))
    );
  }

  /** PUT /materials/:id */
  update(id: string, payload: Partial<Material>): Observable<Material> {
    this.clearCache();
    return this.http.put<ApiResponse<Material>>(`${this.baseUrl}/${id}`, payload).pipe(
      map(resp => resp.data),
      catchError(err => this.handleError(err))
    );
  }

  /** DELETE /materials/:id */
  remove(id: string): Observable<{ _id: string }> {
    this.clearCache();
    return this.http.delete<ApiResponse<{ _id: string }>>(`${this.baseUrl}/${id}`).pipe(
      map(resp => resp.data),
      catchError(err => this.handleError(err))
    );
  }
}
