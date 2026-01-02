// src/app/core/services/user.service.ts
import {Injectable, signal, Signal} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, finalize, map, shareReplay, tap} from 'rxjs/operators';
import {environment} from '../../environments/environment';
import {toObservable} from '@angular/core/rxjs-interop';

import {User, UserListResult} from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: any };
// ✅ payloads
export type SetAccessPayload = { password: string; mustChangePassword?: boolean };
export type AccessResult = { _id: string; authEnabled: boolean; mustChangePassword?: boolean };

@Injectable({ providedIn: 'root' })
export class UserService {
  private baseUrl = `${environment.apiBaseUrl}/users`;

  // -----------------------------
  // Signals
  // -----------------------------
  private _users = signal<User[]>([]);
  readonly users: Signal<User[]> = this._users.asReadonly();

  // meta pagination (optionnel mais très utile pour /admin/users)
  private _meta = signal<{ total: number; page: number; limit: number } | null>(null);
  readonly meta = this._meta.asReadonly();

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<any | null>(null);
  readonly error: Signal<any | null> = this._error.asReadonly();

  private _result = signal<UserListResult | null>(null);
  readonly result = this._result.asReadonly();

  // -----------------------------
  // Cache RxJS
  // -----------------------------
  private _usersRequest$?: Observable<UserListResult>;

  constructor(private http: HttpClient) {}

  // -----------------------------
  // Gestion des erreurs
  // -----------------------------
  private handleError(err: any) {
    console.error(err);
    this._error.set(err);
    return throwError(() => err);
  }

  // -----------------------------
  // Chargement / refresh
  // -----------------------------
  refreshUsers(force = false, filter?: { q?: string; role?: string; depot?: string; page?: number; limit?: number }  ): Observable<UserListResult> {
    if (!force && this._usersRequest$) return this._usersRequest$;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.depot) params = params.set('depot', filter.depot);
    if (filter?.page) params = params.set('page', String(filter.page));
    if (filter?.limit) params = params.set('limit', String(filter.limit));

    const req$ = this.http.get<ApiResponse<UserListResult>>(this.baseUrl, { params }).pipe(
        map(resp => {
          if (!resp?.success) {
            throw resp;
          }
          return resp.data;
        }),
        tap((result) => {
          this._result.set(result);
          this._meta.set({ total: result.total, page: result.page, limit: result.limit });
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
        catchError(err => this.handleError(err)),
        finalize(() => this._loading.set(false))
      );

    this._usersRequest$ = req$;
    return req$;
  }

  // -----------------------------
  // Exposition
  // -----------------------------
  getUsersSignal(): Signal<User[]> {
    return this.users;
  }

  // Observable basé sur le signal
  getUsers$(): Observable<User[]> {
    return toObservable(this._users);
  }

  // -----------------------------
  // CRUD Utilisateur (API renvoie {success, data})
  // -----------------------------
  getUser(id: string): Observable<User> {
    return this.http.get<ApiResponse<User>>(`${this.baseUrl}/${id}`).pipe(
      map(resp => {
        if (!resp?.success) throw resp;
        return resp.data;
      }),
      catchError(err => this.handleError(err))
    );
  }

  createUser(payload: Partial<User>): Observable<User> {
    return this.http.post<ApiResponse<User>>(this.baseUrl, payload).pipe(
      map(resp => {
        if (!resp?.success) throw resp;
        return resp.data;
      }),
      tap(() => {
        this.clearCache();
        // refresh async pour mettre à jour la liste en fond
        this.triggerRefresh();
      }),
      catchError(err => this.handleError(err))
    );
  }

  updateUser(id: string, payload: Partial<User>): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${this.baseUrl}/${id}`, payload).pipe(
      map(resp => {
        if (!resp?.success) throw resp;
        return resp.data;
      }),
      tap(() => {
        this.clearCache();
        this.triggerRefresh();
      }),
      catchError(err => this.handleError(err))
    );
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/${id}`).pipe(
      map(resp => {
        if (!resp?.success) throw resp;
        return void 0;
      }),
      tap(() => {
        this.clearCache();
        this.triggerRefresh();
      }),
      catchError(err => this.handleError(err))
    );
  }

  changePassword(id: string, newPassword: string): Observable<void> {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/${id}/password`, { password: newPassword }).pipe(
      map(resp => {
        if (!resp?.success) throw resp;
        return void 0;
      }),
      catchError(err => this.handleError(err))
    );
  }

  // -----------------------------
  // Connexion
  // -----------------------------

  setAccess(userId: string, payload: SetAccessPayload) {
    return this.http.put<{ success: boolean; data: AccessResult }>(`${this.baseUrl}/${userId}/access`, payload);
  }

  resetPassword(userId: string, payload: SetAccessPayload) {
    return this.http.put<{ success: boolean; data: AccessResult }>(`${this.baseUrl}/${userId}/reset-password`, payload);
  }

  disableAccess(userId: string) {
    return this.http.put<{ success: boolean; data: AccessResult }>(`${this.baseUrl}/${userId}/disable-access`, {});
  }

  exportCsv(filter?: { q?: string; role?: string; depot?: string }): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/export/csv`, { params, responseType: 'blob' as const });
  }

  exportPdf(filter?: { q?: string; role?: string; depot?: string }): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/export/pdf`, { params, responseType: 'blob' as const });
  }

  exportXlsx(filter?: { q?: string; role?: string; depot?: string }): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/export/xlsx`, { params, responseType: 'blob' as const });
  }

  // -----------------------------
  // Utilitaires
  // -----------------------------
  triggerRefresh(): void {
    // On évite de spammer si déjà en cache : force = true pour être sûr d’actualiser
    this.refreshUsers(true).subscribe({ next: () => {}, error: () => {} });
  }
  clearCache(): void {
    this._usersRequest$ = undefined;
  }
}
