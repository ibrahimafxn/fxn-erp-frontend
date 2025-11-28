import { Injectable, signal, Signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {User} from '../models';
import {toObservable} from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class UserService {
  private baseUrl = `${environment.apiBaseUrl}/users`;

  // -----------------------------
  // Signals
  // -----------------------------
  private _users = signal<User[]>([]);
  readonly users: Signal<User[]> = this._users.asReadonly();

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<any | null>(null);
  readonly error: Signal<any | null> = this._error.asReadonly();

  // -----------------------------
  // Cache RxJS
  // -----------------------------
  private _usersRequest$?: Observable<User[]>;

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
  // Chargement / refresh
  // -----------------------------
  refreshUsers(force = false, filter?: { search?: string; role?: string; depot?: string }): Observable<User[]> {
    if (!force && this._usersRequest$) return this._usersRequest$;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.search) params = params.set('search', filter.search);
    if (filter?.role) params = params.set('role', filter.role);
    if (filter?.depot) params = params.set('depot', filter.depot);

    const req$ = this.http.get<User[]>(this.baseUrl, { params }).pipe(
      tap(list => this._users.set(list || [])),
      catchError(err => this.handleError(err)),
      tap(() => this._loading.set(false)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._usersRequest$ = req$;
    return req$;
  }

  // -----------------------------
  // Exposition
  // -----------------------------
  getUsersSignal(): Signal<User[]> { return this.users; }

  // Observable basé sur le signal
  getUsers$(): Observable<User[]> { return toObservable(this._users); }

  // -----------------------------
  // CRUD Utilisateur
  // -----------------------------
  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`).pipe(catchError(err => this.handleError(err)));
  }

  createUser(payload: Partial<User>): Observable<User[]> {
    return this.http.post<User>(this.baseUrl, payload).pipe(
      switchMap(() => { this.clearCache(); return this.refreshUsers(true); }),
      catchError(err => this.handleError(err))
    );
  }

  updateUser(id: string, payload: Partial<User>): Observable<User[]> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, payload).pipe(
      switchMap(() => { this.clearCache(); return this.refreshUsers(true); }),
      catchError(err => this.handleError(err))
    );
  }

  changePassword(id: string, newPassword: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}/password`, { password: newPassword }).pipe(
      catchError(err => this.handleError(err))
    );
  }

  deleteUser(id: string): Observable<User[]> {
    return this.http.delete(`${this.baseUrl}/${id}`).pipe(
      switchMap(() => { this.clearCache(); return this.refreshUsers(true); }),
      catchError(err => this.handleError(err))
    );
  }

  // -----------------------------
  // Utilitaires
  // -----------------------------
  triggerRefresh(): void { this.refreshUsers(true).subscribe({ next: () => {}, error: () => {} }); }
  clearCache(): void { this._usersRequest$ = undefined; }
}
