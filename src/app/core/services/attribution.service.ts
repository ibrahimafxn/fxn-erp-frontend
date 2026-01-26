import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, catchError, map, of, tap, throwError} from 'rxjs';
import {environment} from '../../environments/environment';

const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class AttributionService {
  private attributions$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  listAttributions(filter?: any, options?: { silent?: boolean }) {
    // Exemple: /api/attributions?toUser=...
    const silent = options?.silent ?? true;
    const params = filter ? { params: filter } : {};
    return this.http.get<any>(`${API_BASE}/attributions`, params).pipe(
      map((resp) => {
        if (resp && typeof resp === 'object' && 'items' in resp) {
          return resp as { items: any[]; total: number; page: number; limit: number };
        }
        return { items: Array.isArray(resp) ? resp : [], total: Array.isArray(resp) ? resp.length : 0, page: 1, limit: 500 };
      }),
      tap(list => this.attributions$.next(list.items ?? [])),
      catchError(err => {
        console.error('listAttributions error', err);
        return silent
          ? of({ items: [], total: 0, page: 1, limit: 500 })
          : throwError(() => err);
      })
    );
  }

  getAttributions$() {
    return this.attributions$.asObservable();
  }

  // POST /api/attributions (appel transactionnel backend)
  createAttribution(payload: {
    resourceType: 'MATERIAL' | 'CONSUMABLE' | 'VEHICLE',
    resourceId: string,
    quantity?: number,
    fromDepot?: string,
    toUser?: string,
    action: string,
    note?: string
  }) {
    return this.http.post(`${API_BASE}/attributions`, payload).pipe(
      tap(() => this.listAttributions(undefined, { silent: true }).subscribe())
    );
  }

  // GET history
  listHistory(filter?: any) {
    const params = filter ? { params: filter } : {};
    return this.http.get<any>(`${API_BASE}/attributions/history`, params).pipe(
      map((resp) => {
        if (resp && typeof resp === 'object' && 'items' in resp) {
          return resp as { items: any[]; total: number; page: number; limit: number };
        }
        const items = Array.isArray(resp) ? resp : [];
        return { items, total: items.length, page: 1, limit: items.length || 0 };
      })
    );
  }
}
