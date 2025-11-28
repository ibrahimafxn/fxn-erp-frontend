import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {BehaviorSubject, catchError, Observable, of, tap} from 'rxjs';
import {DepotDashboardStats} from '../models/DepotDashboardStats';
import {environment} from '../../environments/environment';

const API_BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class DepotService {
  private depots$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  // GET /api/depots (endpoint peut varier)
  listDepots() {
    return this.http.get<any[]>(`${API_BASE}/depots`).pipe(
      tap(list => this.depots$.next(list)),
      catchError(err => {
        console.error('listDepots error', err);
        return of([]);
      })
    );
  }

  getDepots$() {
    return this.depots$.asObservable();
  }

  getDepotStats(depotId: string): Observable<DepotDashboardStats> {
    return this.http.get<DepotDashboardStats>(`${environment.apiBaseUrl}/depots/${depotId}/stats`);
  }

  createDepot(payload: any) {
    return this.http.post(`${API_BASE}/depots`, payload).pipe(
      tap(() => this.listDepots().subscribe())
    );
  }

  // transferResourceTransactional sur backend
  transferResource(resourceModel: 'Material' | 'Consumable', resourceId: string, fromDepotId: string, toDepotId: string, quantity: number) {
    return this.http.post(`${API_BASE}/depots/transfer`, {
      resourceModel,
      resourceId,
      fromDepotId,
      toDepotId,
      quantity
    });
  }
}
