import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ReceiptLine = {
  resourceType: 'CONSUMABLE' | 'MATERIAL';
  name: string;
  quantity: number;
  unit?: string;
  category?: 'Outil' | 'EPI';
  minQuantity?: number;
};

export type ReceiptPayload = {
  depotId: string;
  supplier?: string;
  reference?: string;
  note?: string;
  lines: ReceiptLine[];
};

export type ReceiptResult = {
  count: number;
  items: Array<{ resourceType: string; resourceId: string; quantity: number }>;
};

@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private baseUrl = `${environment.apiBaseUrl}/receipts`;

  constructor(private http: HttpClient) {}

  createReceipt(payload: ReceiptPayload): Observable<{ success: boolean; data: ReceiptResult }> {
    return this.http.post<{ success: boolean; data: ReceiptResult }>(this.baseUrl, payload);
  }
}
