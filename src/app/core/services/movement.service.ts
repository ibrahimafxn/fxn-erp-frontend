import { Injectable, Signal, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Movement, MovementListResult } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: any };

@Injectable({ providedIn: 'root' })
export class MovementService {
  private baseUrl = `${environment.apiBaseUrl}/movements`;

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<any | null>(null);
  readonly error: Signal<any | null> = this._error.asReadonly();

  private _result = signal<MovementListResult | null>(null);
  readonly result = this._result.asReadonly();

  private _listRequest$?: Observable<MovementListResult>;

  constructor(private http: HttpClient) {}

  private handleError(err: any) {
    console.error(err);
    this._error.set(err);
    return throwError(() => err);
  }

  listMovements(
    force = false,
    filter?: {
      resourceType?: string;
      resourceId?: string;
      action?: string;
      status?: string;
      depotId?: string;
      fromType?: string;
      fromId?: string;
      toType?: string;
      toId?: string;
      page?: number;
      limit?: number;
    }
  ): Observable<MovementListResult> {
    if (!force && this._listRequest$) return this._listRequest$;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.resourceType) params = params.set('resourceType', filter.resourceType);
    if (filter?.resourceId) params = params.set('resourceId', filter.resourceId);
    if (filter?.action) params = params.set('action', filter.action);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.fromType) params = params.set('fromType', filter.fromType);
    if (filter?.fromId) params = params.set('fromId', filter.fromId);
    if (filter?.toType) params = params.set('toType', filter.toType);
    if (filter?.toId) params = params.set('toId', filter.toId);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));

    const req$ = this.http.get<ApiResponse<MovementListResult>>(this.baseUrl, { params }).pipe(
      map(resp => {
        if (!resp?.success) throw resp;
        return resp.data;
      }),
      tap((result) => this._result.set(result)),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(err => this.handleError(err)),
      finalize(() => this._loading.set(false))
    );

    this._listRequest$ = req$;
    return req$;
  }

  clearCache(): void {
    this._listRequest$ = undefined;
  }

  refresh(force = false, filter?: Parameters<MovementService['listMovements']>[1]) {
    return this.listMovements(force, filter);
  }

  exportCsv(filter?: Parameters<MovementService['listMovements']>[1]): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.resourceType) params = params.set('resourceType', filter.resourceType);
    if (filter?.resourceId) params = params.set('resourceId', filter.resourceId);
    if (filter?.action) params = params.set('action', filter.action);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.fromType) params = params.set('fromType', filter.fromType);
    if (filter?.fromId) params = params.set('fromId', filter.fromId);
    if (filter?.toType) params = params.set('toType', filter.toType);
    if (filter?.toId) params = params.set('toId', filter.toId);
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' }).pipe(
      catchError(err => this.handleError(err))
    );
  }

  exportPdf(filter?: Parameters<MovementService['listMovements']>[1]): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.resourceType) params = params.set('resourceType', filter.resourceType);
    if (filter?.resourceId) params = params.set('resourceId', filter.resourceId);
    if (filter?.action) params = params.set('action', filter.action);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.fromType) params = params.set('fromType', filter.fromType);
    if (filter?.fromId) params = params.set('fromId', filter.fromId);
    if (filter?.toType) params = params.set('toType', filter.toType);
    if (filter?.toId) params = params.set('toId', filter.toId);
    return this.http.get(`${this.baseUrl}/export/pdf`, { params, responseType: 'blob' }).pipe(
      catchError(err => this.handleError(err))
    );
  }
}
