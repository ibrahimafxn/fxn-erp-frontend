import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type Order = {
  _id: string;
  reference: string;
  client: string;
  date: string;
  status: string;
  amount: number;
  notes?: string;
};

export type OrderListResult = {
  total: number;
  page: number;
  limit: number;
  items: Order[];
};

export type OrderListQuery = {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export type OrderPayload = {
  reference: string;
  client: string;
  date: string;
  status: string;
  amount: number;
  notes?: string;
};

@Injectable({ providedIn: 'root' })
export class OrderService {
  private baseUrl = `${environment.apiBaseUrl}/orders`;

  constructor(private http: HttpClient) {}

  list(query: OrderListQuery = {}): Observable<{ success: boolean; data: OrderListResult }> {
    const params: Record<string, string> = {};
    if (query.q) params.q = query.q;
    if (query.status) params.status = query.status;
    if (query.page) params.page = String(query.page);
    if (query.limit) params.limit = String(query.limit);
    return this.http.get<{ success: boolean; data: OrderListResult }>(this.baseUrl, { params });
  }

  create(payload: OrderPayload): Observable<{ success: boolean; data: Order }> {
    return this.http.post<{ success: boolean; data: Order }>(this.baseUrl, payload);
  }

  getById(id: string): Observable<{ success: boolean; data: Order }> {
    return this.http.get<{ success: boolean; data: Order }>(`${this.baseUrl}/${id}`);
  }
}
