import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { EffectiveBpuItem } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class EffectiveBpuService {
  private readonly baseUrl = `${environment.apiBaseUrl}/technicians`;

  constructor(private http: HttpClient) {}

  getTechnicianEffectiveBpu(technicianId: string): Observable<EffectiveBpuItem[]> {
    return this.http.get<ApiResponse<EffectiveBpuItem[]>>(`${this.baseUrl}/${technicianId}/effective-bpu`).pipe(
      map((resp) => resp.data || []),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }
}
