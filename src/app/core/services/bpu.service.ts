import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BpuEntry } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };
type BpuSegment = 'AUTO' | 'SALARIE' | 'PERSONNALISE' | 'AUTRE';
type BpuMeta = { segment: BpuSegment; title: string };

@Injectable({ providedIn: 'root' })
export class BpuService {
  private readonly baseUrl = `${environment.apiBaseUrl}/bpu`;

  private _items = signal<BpuEntry[]>([]);
  readonly items = this._items.asReadonly();

  private _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private _error = signal<HttpErrorResponse | null>(null);
  readonly error = this._error.asReadonly();

  constructor(private http: HttpClient) {}

  list(segment?: BpuSegment): Observable<BpuEntry[]> {
    this._loading.set(true);
    this._error.set(null);
    const url = segment ? `${this.baseUrl}?segment=${segment}` : this.baseUrl;
    return this.http.get<ApiResponse<BpuEntry[]>>(url).pipe(
      map((resp) => resp.data || []),
      tap((items) => {
        this._items.set(items);
        this._loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this._loading.set(false);
        this._error.set(err);
        return throwError(() => err);
      })
    );
  }

  getMeta(segment: BpuSegment): Observable<BpuMeta> {
    return this.http.get<ApiResponse<BpuMeta>>(
      `${this.baseUrl}/meta?segment=${segment}`
    ).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  saveMeta(segment: BpuSegment, title: string): Observable<BpuMeta> {
    return this.http.put<ApiResponse<BpuMeta>>(
      `${this.baseUrl}/meta`,
      { segment, title }
    ).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  bulkUpsert(segment: BpuSegment, items: { prestation: string; code: string; unitPrice: number }[]): Observable<{
    imported: number;
    created?: number;
    updated?: number;
    skipped?: number;
  }> {
    return this.http.post<ApiResponse<{ imported: number; created?: number; updated?: number; skipped?: number }>>(
      `${this.baseUrl}/bulk`,
      { segment, items }
    ).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  upsert(payload: { prestation: string; code: string; unitPrice: number; segment: BpuSegment }): Observable<BpuEntry> {
    return this.http.post<ApiResponse<BpuEntry>>(this.baseUrl, payload).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  updateCode(id: string, code: string): Observable<BpuEntry> {
    return this.http.put<ApiResponse<BpuEntry>>(`${this.baseUrl}/${id}`, { code }).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  importCsv(file: File, segment: BpuSegment): Observable<{ imported: number; created?: number; updated?: number; skipped?: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('segment', segment);
    return this.http.post<ApiResponse<{ imported: number; created?: number; updated?: number; skipped?: number }>>(
      `${this.baseUrl}/import`,
      formData
    ).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  exportCsv(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export`, { responseType: 'blob' }).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  exportPdf(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export/pdf`, { responseType: 'blob' }).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }
}
