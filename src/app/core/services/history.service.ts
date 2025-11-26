import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private baseUrl = '/api/history';

  constructor(private http: HttpClient) {}

  /** Récupère l’historique avec filtres */
  getHistory(filter?: { userId?: string; depotId?: string; type?: string; fromDate?: string; toDate?: string }): Observable<any> {
    let params = new HttpParams();
    if (filter?.userId) params = params.set('userId', filter.userId);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get(this.baseUrl, { params });
  }

  /** Exporter l’historique en Excel */
  exportExcel(filter?: { userId?: string; depotId?: string; type?: string; fromDate?: string; toDate?: string }): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.userId) params = params.set('userId', filter.userId);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' });
  }
}
