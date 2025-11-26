import { Injectable, signal, Signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { tap, catchError, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {User} from '../models';

// Typages minimaux — à étendre selon ton backend
export interface Depot { idDepot?: string; name?: string; location?: string; }
export interface Resource { id?: string; name?: string; type?: string; depotId?: string; }
export interface HistoryItem { id?: string; resourceType?: string; resourceId?: string; action?: string; timestamp?: string; }
export interface DashboardStats {
  totalUsers: number;
  totalDepots: number;
  totalMaterials: number;
  totalVehicles: number;
  totalConsumables: number;
  // autres stats si nécessaire
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private baseUrl = `${environment.apiBaseUrl}/admin`;

  // -----------------------------
  // Signals
  // -----------------------------
  private _users = signal<User[]>([]);
  readonly users: Signal<User[]> = this._users.asReadonly();
  private _depots = signal<Depot[]>([]);
  readonly depots: Signal<Depot[]> = this._depots.asReadonly();
  private _resources = signal<Resource[]>([]);
  readonly resources: Signal<Resource[]> = this._resources.asReadonly();
  private _history = signal<HistoryItem[]>([]);
  readonly history: Signal<HistoryItem[]> = this._history.asReadonly();

  private _stats = signal<DashboardStats | null>(null);
  readonly stats: Signal<DashboardStats | null> = this._stats.asReadonly();

  private _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private _error = signal<any | null>(null);
  readonly error = this._error.asReadonly();
  // -----------------------------
  // Cache RxJS pour éviter appels répétés
  // -----------------------------
  private _usersRequest$?: Observable<User[]>;
  private _depotsRequest$?: Observable<Depot[]>;
  private _resourcesRequest$?: Observable<Resource[]>;
  private _historyRequest$?: Observable<HistoryItem[]>;

  constructor(private http: HttpClient) {}

  // -----------------------------
  // Gestion des erreurs
  // -----------------------------
  private handleError(err: any) {
    console.error(err);
    this._error.set(err);
    this._loading.set(false);
    return throwError(() => err);
  }

  // -----------------------------
  // DASHBOARD
  // -----------------------------
  loadDashboardStats() {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<DashboardStats>(`${environment.apiBaseUrl}/admin/dashboard`).pipe(
      tap(stats => this._stats.set(stats)),
      catchError(err => {
        this._error.set(err);
        return throwError(() => err);
      }),
      tap(() => this._loading.set(false))
    ).subscribe();
  }

  // -----------------------------
  // UTILISATEURS
  // -----------------------------
  refreshUsers(force = false, filter?: { search?: string; role?: string; depot?: string }): Observable<User[]> {
    if (!force && this._usersRequest$) return this._usersRequest$;
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.search) params = params.set('search', filter.search);
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.depot) params = params.set('depot', filter.depot);

    const req$ = this.http.get<User[]>(`${this.baseUrl}/users`, { params }).pipe(
      tap(list => this._users.set(list || [])),
      catchError(err => this.handleError(err)),
      tap(() => this._loading.set(false)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._usersRequest$ = req$;
    return req$;
  }

  getUsersSignal(): Signal<User[]> { return this.users; }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/${id}`).pipe(catchError(err => this.handleError(err)));
  }

  createUser(payload: Partial<User>): Observable<User[]> {
    return this.http.post<User>(`${this.baseUrl}/users`, payload).pipe(
      switchMap(() => { this._usersRequest$ = undefined; return this.refreshUsers(true); }),
      catchError(err => this.handleError(err))
    );
  }

  updateUser(id: string, payload: Partial<User>): Observable<User[]> {
    return this.http.put<User>(`${this.baseUrl}/users/${id}`, payload).pipe(
      switchMap(() => { this._usersRequest$ = undefined; return this.refreshUsers(true); }),
      catchError(err => this.handleError(err))
    );
  }

  deleteUser(id: string): Observable<User[]> {
    return this.http.delete(`${this.baseUrl}/users/${id}`).pipe(
      switchMap(() => { this._usersRequest$ = undefined; return this.refreshUsers(true); }),
      catchError(err => this.handleError(err))
    );
  }

  // -----------------------------
  // DEPOTS
  // -----------------------------
  refreshDepots(force = false): Observable<Depot[]> {
    if (!force && this._depotsRequest$) return this._depotsRequest$;
    this._loading.set(true);
    this._error.set(null);

    const req$ = this.http.get<Depot[]>(`${this.baseUrl}/depots`).pipe(
      tap(list => this._depots.set(list || [])),
      catchError(err => this.handleError(err)),
      tap(() => this._loading.set(false)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._depotsRequest$ = req$;
    return req$;
  }

  getDepotsSignal(): Signal<Depot[]> { return this.depots; }

  createDepot(payload: Partial<Depot>): Observable<Depot[]> {
    return this.http.post<Depot>(`${this.baseUrl}/depots`, payload).pipe(
      switchMap(() => { this._depotsRequest$ = undefined; return this.refreshDepots(true); }),
      catchError(err => this.handleError(err))
    );
  }

  updateDepot(id: string, payload: Partial<Depot>): Observable<Depot[]> {
    return this.http.put<Depot>(`${this.baseUrl}/depots/${id}`, payload).pipe(
      switchMap(() => { this._depotsRequest$ = undefined; return this.refreshDepots(true); }),
      catchError(err => this.handleError(err))
    );
  }

  deleteDepot(id: string): Observable<Depot[]> {
    return this.http.delete(`${this.baseUrl}/depots/${id}`).pipe(
      switchMap(() => { this._depotsRequest$ = undefined; return this.refreshDepots(true); }),
      catchError(err => this.handleError(err))
    );
  }

  // -----------------------------
  // RESSOURCES
  // -----------------------------
  refreshResources(type: string, depotId?: string, force = false): Observable<Resource[]> {
    if (!force && this._resourcesRequest$) return this._resourcesRequest$;
    this._loading.set(true);
    this._error.set(null);

    let params = depotId ? new HttpParams().set('depotId', depotId) : undefined;

    const req$ = this.http.get<Resource[]>(`${this.baseUrl}/resources/${type}`, { params }).pipe(
      tap(list => this._resources.set(list || [])),
      catchError(err => this.handleError(err)),
      tap(() => this._loading.set(false)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._resourcesRequest$ = req$;
    return req$;
  }

  getResourcesSignal(): Signal<Resource[]> { return this.resources; }

  createResource(type: string, payload: Partial<Resource>): Observable<Resource[]> {
    return this.http.post<Resource>(`${this.baseUrl}/resources/${type}`, payload).pipe(
      switchMap(() => { this._resourcesRequest$ = undefined; return this.refreshResources(type, payload.depotId, true); }),
      catchError(err => this.handleError(err))
    );
  }

  updateResource(type: string, id: string, payload: Partial<Resource>): Observable<Resource[]> {
    return this.http.put<Resource>(`${this.baseUrl}/resources/${type}/${id}`, payload).pipe(
      switchMap(() => { this._resourcesRequest$ = undefined; return this.refreshResources(type, payload.depotId, true); }),
      catchError(err => this.handleError(err))
    );
  }

  deleteResource(type: string, id: string, depotId?: string): Observable<Resource[]> {
    return this.http.delete(`${this.baseUrl}/resources/${type}/${id}`).pipe(
      switchMap(() => { this._resourcesRequest$ = undefined; return this.refreshResources(type, depotId, true); }),
      catchError(err => this.handleError(err))
    );
  }

  // -----------------------------
  // HISTORIQUE / MOUVEMENTS
  // -----------------------------
  refreshHistory(filter?: { userId?: string; depotId?: string; type?: string; fromDate?: string; toDate?: string }, force = false): Observable<HistoryItem[]> {
    if (!force && this._historyRequest$) return this._historyRequest$;
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.userId) params = params.set('userId', filter.userId);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params = params.set('toDate', filter.toDate);

    const req$ = this.http.get<HistoryItem[]>(`${this.baseUrl}/history`, { params }).pipe(
      tap(list => this._history.set(list || [])),
      catchError(err => this.handleError(err)),
      tap(() => this._loading.set(false)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._historyRequest$ = req$;
    return req$;
  }

  getHistorySignal(): Signal<HistoryItem[]> { return this.history; }

  exportHistoryExcel(filter?: { userId?: string; depotId?: string; type?: string; fromDate?: string; toDate?: string }): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.userId) params = params.set('userId', filter.userId);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.type) params = params.set('type', filter.type);
    if (filter?.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params = params.set('toDate', filter.toDate);

    return this.http.get(`${this.baseUrl}/history/export`, { params, responseType: 'blob' });
  }

  // -----------------------------
  // Utilitaires
  // -----------------------------
  clearCache(): void {
    this._usersRequest$ = undefined;
    this._depotsRequest$ = undefined;
    this._resourcesRequest$ = undefined;
    this._historyRequest$ = undefined;
  }
}
