import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Charge, ChargeType } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export type ChargeList = {
  total: number;
  page: number;
  limit: number;
  items: Charge[];
};

@Injectable({ providedIn: 'root' })
export class ChargeService {
  private baseUrl = `${environment.apiBaseUrl}/charges`;

  constructor(private http: HttpClient) {}

  listMine(params?: { page?: number; limit?: number; month?: string; type?: ChargeType | '' }): Observable<ApiResponse<ChargeList>> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.month) httpParams = httpParams.set('month', params.month);
    if (params?.type) httpParams = httpParams.set('type', params.type);
    return this.http.get<ApiResponse<ChargeList>>(`${this.baseUrl}/my`, { params: httpParams });
  }

  summaryMineByMonth(year: number): Observable<ApiResponse<{ year: number; months: { month: string; totalAmount: number }[] }>> {
    const params = new HttpParams().set('year', String(year));
    return this.http.get<ApiResponse<{ year: number; months: { month: string; totalAmount: number }[] }>>(
      `${this.baseUrl}/my/summary-by-month`,
      { params }
    );
  }

  create(payload: { type: ChargeType; amount: number; month: string; note?: string }): Observable<ApiResponse<Charge>> {
    return this.http.post<ApiResponse<Charge>>(this.baseUrl, payload);
  }

  update(id: string, payload: { type: ChargeType; amount: number; month: string; note?: string }): Observable<ApiResponse<Charge>> {
    return this.http.put<ApiResponse<Charge>>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<ApiResponse<{ _id: string }>> {
    return this.http.delete<ApiResponse<{ _id: string }>>(`${this.baseUrl}/${id}`);
  }
}
