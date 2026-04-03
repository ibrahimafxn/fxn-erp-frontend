import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Order } from './order.service';

export type Supplier = {
  _id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SupplierListResult = {
  total: number;
  page: number;
  limit: number;
  items: Supplier[];
};

export type SupplierOrderListResult = {
  total: number;
  page: number;
  limit: number;
  items: Order[];
};

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private baseUrl = `${environment.apiBaseUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  list(query: { q?: string; page?: number; limit?: number } = {}): Observable<{ success: boolean; data: SupplierListResult }> {
    const params: Record<string, string> = {};
    if (query.q) params['q'] = query.q;
    if (query.page) params['page'] = String(query.page);
    if (query.limit) params['limit'] = String(query.limit);
    return this.http.get<{ success: boolean; data: SupplierListResult }>(this.baseUrl, { params });
  }

  getById(id: string): Observable<{ success: boolean; data: Supplier }> {
    return this.http.get<{ success: boolean; data: Supplier }>(`${this.baseUrl}/${id}`);
  }

  listOrders(id: string, query: { page?: number; limit?: number } = {}): Observable<{ success: boolean; data: SupplierOrderListResult }> {
    const params: Record<string, string> = {};
    if (query.page) params['page'] = String(query.page);
    if (query.limit) params['limit'] = String(query.limit);
    return this.http.get<{ success: boolean; data: SupplierOrderListResult }>(`${this.baseUrl}/${id}/orders`, { params });
  }

  create(payload: { name: string }): Observable<{ success: boolean; data: Supplier }> {
    return this.http.post<{ success: boolean; data: Supplier }>(this.baseUrl, payload);
  }

  update(id: string, payload: { name: string }): Observable<{ success: boolean; data: Supplier }> {
    return this.http.put<{ success: boolean; data: Supplier }>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ success: boolean; data: Supplier }> {
    return this.http.delete<{ success: boolean; data: Supplier }>(`${this.baseUrl}/${id}`);
  }
}
