import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, of, tap } from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class ConsumableService {
  private consumables$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  listConsumables(depotId?: string) {
    const url = depotId ? `${API_BASE}/consumables?idDepot=${depotId}` : `${API_BASE}/consumables`;
    return this.http.get<any[]>(url).pipe(
      tap(list => this.consumables$.next(list)),
      catchError(err => {
        console.error('listConsumables error', err);
        return of([]);
      })
    );
  }

  getConsumables$() {
    return this.consumables$.asObservable();
  }

  createConsumable(payload: any) {
    return this.http.post(`${API_BASE}/consumables`, payload).pipe(
      tap(() => this.listConsumables().subscribe())
    );
  }

  updateConsumable(id: string, payload: any) {
    return this.http.put(`${API_BASE}/consumables/${id}`, payload).pipe(
      tap(() => this.listConsumables().subscribe())
    );
  }

  deleteConsumable(id: string) {
    return this.http.delete(`${API_BASE}/consumables/${id}`).pipe(
      tap(() => this.listConsumables().subscribe())
    );
  }

  // Réserver (ATTRIBUTION transactionnelle côté backend)
  reserveConsumable(consumableId: string, qty: number, toUser?: string, fromDepot?: string, author?: string) {
    return this.http.post(`${API_BASE}/consumables/reserve`, {
      consumableId, qty, toUser, fromDepot, author
    }).pipe(tap(() => this.listConsumables().subscribe()));
  }
}
