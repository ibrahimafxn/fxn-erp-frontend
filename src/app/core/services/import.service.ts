import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type ImportResult = {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export type ImportResponse = {
  success: boolean;
  data: ImportResult;
  message?: string;
};

@Injectable({ providedIn: 'root' })
export class ImportService {
  private baseUrl = `${environment.apiBaseUrl}/import`;

  constructor(private http: HttpClient) {}

  private postCsv(path: string, csv: string) {
    const headers = new HttpHeaders({ 'Content-Type': 'text/csv' });
    return this.http.post<ImportResponse>(`${this.baseUrl}/${path}`, csv, { headers });
  }

  importDepots(csv: string) {
    return this.postCsv('depots', csv);
  }

  importUsers(csv: string) {
    return this.postCsv('users', csv);
  }

  importMaterials(csv: string) {
    return this.postCsv('materials', csv);
  }

  importConsumables(csv: string) {
    return this.postCsv('consumables', csv);
  }

  importVehicles(csv: string) {
    return this.postCsv('vehicles', csv);
  }

  importOrders(csv: string) {
    return this.postCsv('orders', csv);
  }
}
