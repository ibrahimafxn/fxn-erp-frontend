import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BpuType } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class BpuTypeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/bpu/types`;

  constructor(private http: HttpClient) {}

  list(): Observable<BpuType[]> {
    return this.http.get<ApiResponse<BpuType[]>>(this.baseUrl).pipe(
      map((resp) => resp.data || []),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  getOne(id: string): Observable<BpuType> {
    return this.http.get<ApiResponse<BpuType>>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  create(payload: { type: string }): Observable<BpuType> {
    return this.http.post<ApiResponse<BpuType>>(this.baseUrl, payload).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  update(id: string, payload: { type: string }): Observable<BpuType> {
    return this.http.put<ApiResponse<BpuType>>(`${this.baseUrl}/${id}`, payload).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  remove(id: string): Observable<{ id: string }> {
    return this.http.delete<ApiResponse<{ id: string }>>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }
}
