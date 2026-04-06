import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthHistoryResult } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthHistoryService {
  private baseUrl = `${environment.apiBaseUrl}/auth`;

  constructor(private http: HttpClient) {}

  listHistory(filter?: { user?: string; action?: string; status?: string; date?: string; page?: number; limit?: number }) {
    let params = new HttpParams();
    if (filter?.user) params = params.set('user', filter.user);
    if (filter?.action) params = params.set('action', filter.action);
    if (filter?.status) params = params.set('status', filter.status);
    if (filter?.date) params = params.set('date', filter.date);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));

    return this.http
      .get<{ success: boolean; data: AuthHistoryResult }>(`${this.baseUrl}/history`, { params })
      .pipe(map(resp => resp.data));
  }
}
