import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BpuSelection } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class BpuSelectionService {
  private readonly baseUrl = `${environment.apiBaseUrl}/bpu/selections`;

  constructor(private http: HttpClient) {}

  create(payload: { type: string; prestations: { code: string; unitPrice: number }[] }): Observable<BpuSelection> {
    return this.http.post<ApiResponse<BpuSelection>>(this.baseUrl, payload).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  list(): Observable<BpuSelection[]> {
    return this.http.get<ApiResponse<BpuSelection[]>>(this.baseUrl).pipe(
      map((resp) => resp.data || []),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }
}
