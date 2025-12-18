import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, catchError, of, tap} from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class AttributionService {
  private attributions$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  listAttributions(filter?: any) {
    // Exemple: /api/attributions?toUser=...
    const params = filter ? { params: filter } : {};
    return this.http.get<any[]>(`${API_BASE}/attributions`, params).pipe(
      tap(list => this.attributions$.next(list)),
      catchError(err => {
        console.error('listAttributions error', err);
        return of([]);
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
      tap(() => this.listAttributions().subscribe())
    );
  }

  // GET history
  listHistory(filter?: any) {
    const params = filter ? { params: filter } : {};
    return this.http.get<any[]>(`${API_BASE}/attributions/history`, params);
  }
}
