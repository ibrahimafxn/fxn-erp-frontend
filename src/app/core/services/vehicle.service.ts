// core/services/vehicle.service.ts
import { Injectable, Signal, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Vehicule } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: unknown };

export interface VehicleListResult {
  total: number;
  page: number;
  limit: number;
  items: Vehicule[];
}

export type VehicleFilter = {
  q?: string;
  depot?: string; // compat: depot ou idDepot
  page?: number;
  limit?: number;
};

export interface VehicleHistoryEntry {
  _id: string;
  vehicleId: string;
  action: 'ASSIGN' | 'RELEASE';
  createdAt: string | Date;

  fromDepot?: { _id: string; name?: string; city?: string } | null;
  toDepot?: { _id: string; name?: string; city?: string } | null;

  fromUser?: { _id: string; firstName?: string; lastName?: string; email?: string; role?: string } | null;
  toUser?: { _id: string; firstName?: string; lastName?: string; email?: string; role?: string } | null;

  author?: { _id: string; firstName?: string; lastName?: string; email?: string; role?: string } | null;
}

export interface VehicleHistoryResult {
  total: number;
  page: number;
  limit: number;
  items: VehicleHistoryEntry[];
}

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private baseUrl = `${environment.apiBaseUrl}/vehicles`;

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<HttpErrorResponse | null>(null);
  readonly error: Signal<HttpErrorResponse | null> = this._error.asReadonly();

  private _result = signal<VehicleListResult | null>(null);
  readonly result: Signal<VehicleListResult | null> = this._result.asReadonly();

  private _request$?: Observable<VehicleListResult>;

  constructor(private http: HttpClient) {}

  private handleError(err: HttpErrorResponse) {
    this._error.set(err);
    this._loading.set(false);
    return throwError(() => err);
  }

  clearCache(): void {
    this._request$ = undefined;
  }

  refresh(force = false, filter?: VehicleFilter): Observable<VehicleListResult> {
    if (!force && this._request$) return this._request$;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.depot) params = params.set('depot', filter.depot);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));

    const req$ = this.http.get<ApiResponse<VehicleListResult>>(this.baseUrl, { params }).pipe(
      map((resp) => resp.data),
      tap((data) => this._result.set(data)),
      tap(() => this._loading.set(false)),
      catchError((err) => this.handleError(err))
    );

    // cache par défaut (comme vos autres services)
    this._request$ = req$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
    return this._request$;
  }

  getById(id: string): Observable<Vehicule> {
    return this.http.get<ApiResponse<Vehicule>>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }

  create(payload: Partial<Vehicule>): Observable<Vehicule> {
    this.clearCache();
    return this.http.post<ApiResponse<Vehicule>>(this.baseUrl, payload).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }

  update(id: string, payload: Partial<Vehicule>): Observable<Vehicule> {
    this.clearCache();
    return this.http.put<ApiResponse<Vehicule>>(`${this.baseUrl}/${id}`, payload).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }

  remove(id: string): Observable<{ _id: string }> {
    this.clearCache();
    return this.http.delete<ApiResponse<{ _id: string }>>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }

  assign(vehicleId: string, techId: string): Observable<Vehicule> {
    this.clearCache();
    return this.http.put<ApiResponse<Vehicule>>(`${this.baseUrl}/${vehicleId}/assign`, { techId }).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }

  release(vehicleId: string, depotId: string): Observable<Vehicule> {
    this.clearCache();
    return this.http.put<ApiResponse<Vehicule>>(`${this.baseUrl}/${vehicleId}/release`, { depotId }).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }

  history(vehicleId: string, page = 1, limit = 25): Observable<VehicleHistoryResult> {
    const params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    return this.http.get<ApiResponse<VehicleHistoryResult>>(`${this.baseUrl}/${vehicleId}/history`, { params }).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }
}
