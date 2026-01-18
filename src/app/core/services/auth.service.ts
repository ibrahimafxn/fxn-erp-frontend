// src/app/core/services/auth.service.ts

import {inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {Observable, of, ReplaySubject, throwError} from 'rxjs';
import {catchError, filter, map, take, tap} from 'rxjs/operators';
import {environment} from '../../environments/environment';
import {Role} from '../models/roles.model';

/**
 * Représentation du user renvoyé par le backend.
 * Aligné avec buildUserPayload() dans auth.controller.js
 */
export interface AuthUser {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  avatarUrl?: string;
  role: Role;
  idDepot?: string | null;
  assignedVehicle?: string | null;
}

/**
 * Réponse standard des endpoints /auth/login et /auth/refresh
 */
export interface LoginResponse {
  accessToken: string;
  user?: AuthUser;
}

const LS_KEY_ACCESS = 'fxn_access_token';
const LS_KEY_USER = 'fxn_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  /** Base URL de l'API, sans slash final */
  private apiBase = (environment.apiBaseUrl || '').replace(/\/+$/, '');

  /**
   * Token d'accès courant (également persisté en localStorage pour
   * que l'utilisateur reste connecté après refresh de la page).
   */
  private accessToken: string | null = this.loadAccessTokenFromStorage();

  /**
   * User courant sous forme de signal.
   * - source : localStorage au démarrage
   * - lecture : this.user$() dans le code / template
   */
  private readonly _user = signal<AuthUser | null>(this.loadUserFromStorage());
  /** Signal readonly exposé au reste de l'app */
  readonly user$ = this._user.asReadonly();

  /**
   * Gestion mutualisée des refresh token :
   * - refreshInProgress = true => une seule requête /auth/refresh en cours
   * - les autres appels à refreshToken() s'abonnent à refreshSubject
   */
  private refreshInProgress = false;
  private refreshSubject = new ReplaySubject<string | null>(1);

  // ─────────────────────────────────────────────
  // Helpers de persistance locale
  // ─────────────────────────────────────────────

  private loadAccessTokenFromStorage(): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(LS_KEY_ACCESS);
    } catch {
      return null;
    }
  }

  private loadUserFromStorage(): AuthUser | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(LS_KEY_USER);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }

  private persistAccessToken(token: string | null): void {
    this.accessToken = token;
    if (typeof localStorage === 'undefined') return;
    try {
      if (token) {
        localStorage.setItem(LS_KEY_ACCESS, token);
      } else {
        localStorage.removeItem(LS_KEY_ACCESS);
      }
    } catch {
      // on ignore les erreurs de stockage
    }
  }

  private persistUser(user: AuthUser | null): void {
    // maj du signal
    this._user.set(user);

    // persistance locale
    if (typeof localStorage === 'undefined') return;
    try {
      if (user) {
        localStorage.setItem(LS_KEY_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(LS_KEY_USER);
      }
    } catch {
      // ignore storage errors
    }
  }

  // ─────────────────────────────────────────────
  // Accès lecture simple
  // ─────────────────────────────────────────────

  /**
   * Retourne le token d'accès courant (utilisé par l'interceptor).
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Retourne le user courant (ou null si non connecté).
   * Utilise le signal interne.
   */
  getCurrentUser(): AuthUser | null {
    return this.user$();
  }

  /**
   * Indique si l'utilisateur est actuellement authentifié côté front.
   * Note : si le token est expiré, le backend renverra 401, et l'interceptor
   * tentera un refresh.
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Rôle actuel de l'utilisateur (ou null si non connecté).
   */
  getUserRole(): Role | null {
    return this.user$()?.role ?? null;
  }

  /**
   * Helper pratique pour vérifier un rôle côté front.
   */
  hasRole(roles: AuthUser['role'][]): boolean {
    const role = this.getUserRole();
    return !!role && roles.includes(role);
  }

  updateCurrentUser(patch: Partial<AuthUser>): void {
    const current = this._user();
    if (!current) return;
    this.persistUser({ ...current, ...patch });
  }

  // ─────────────────────────────────────────────
  // Authentification
  // ─────────────────────────────────────────────

  /**
   * Login :
   * - envoie email/password au backend
   * - backend :
   *   - vérifie user + password
   *   - renvoie { accessToken, user }
   *   - pose un cookie httpOnly refreshToken côté navigateur
   * - front :
   *   - stocke accessToken en mémoire + localStorage
   *   - stocke user
   */
  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiBase}/auth/login`, credentials, {
        // IMPORTANT pour que le cookie refreshToken soit posé
        withCredentials: true
      })
      .pipe(
        tap(resp => {
          if (!resp || !resp.accessToken) {
            throw new Error('Réponse login invalide : accessToken manquant');
          }
          this.persistAccessToken(resp.accessToken);
          if (resp.user) {
            this.persistUser(resp.user);
          }
        })
      );
  }

  /**
   * Déconnexion :
   * - appelle /auth/logout pour permettre au backend d'invalider le refreshToken
   * - efface accessToken + user côté front
   * - redirige vers /login si redirect = true
   */
  logout(redirect = true): Observable<any> {
    const logout$ = this.http
      .post(`${this.apiBase}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        catchError(() => {
          // même si le backend renvoie une erreur, on force le logout côté front
          return of(null);
        })
      );

    // Nettoyage côté front immédiat
    this.persistAccessToken(null);
    this.persistUser(null);
    this.refreshInProgress = false;
    this.refreshSubject = new ReplaySubject<string | null>(1);

    if (redirect) {
      logout$.subscribe(() => this.router.navigate(['/login']));
    } else {
      logout$.subscribe();
    }

    return logout$;
  }

  // ─────────────────────────────────────────────
  // Refresh token (utilisé par l'interceptor)
  // ─────────────────────────────────────────────

  /**
   * Tente de rafraîchir l'accessToken en appelant /auth/refresh.
   *
   * Côté backend :
   * - lit le refreshToken dans le cookie httpOnly
   * - vérifie en base qu'il est valide + non expiré
   * - renvoie { accessToken, user }
   * - (optionnel) fait une rotation du refreshToken + met à jour le cookie
   *
   * Côté front :
   * - met à jour accessToken + user
   * - renvoie un Observable<string> avec le nouveau token
   *
   * Si le refresh échoue, l'interceptor appellera logout() puis relancera l'erreur.
   */
  refreshToken(): Observable<string> {
    // Si un refresh est déjà en cours, on s'abonne au résultat
    if (this.refreshInProgress) {
      return this.refreshSubject.asObservable().pipe(
        filter((token): token is string => !!token),
        take(1)
      );
    }

    this.refreshInProgress = true;

    const refresh$ = this.http
      .post<LoginResponse>(`${this.apiBase}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(resp => {
          if (!resp || !resp.accessToken) {
            throw new Error('Réponse refresh invalide : accessToken manquant');
          }
          // Mise à jour côté front
          this.persistAccessToken(resp.accessToken);
          if (resp.user) {
            this.persistUser(resp.user);
          }
          // on envoie le nouveau token aux abonnés
          this.refreshSubject.next(resp.accessToken);
        }),
        map(resp => resp.accessToken),
        catchError(err => {
          // En cas d'échec du refresh, on avertit les abonnés avec null
          this.refreshSubject.next(null);
          // La responsabilité de logout + redirection est gérée dans l'interceptor
          return throwError(() => err);
        }),
        tap({
          next: () => {
            this.refreshInProgress = false;
            // on recrée un nouveau ReplaySubject pour le prochain cycle
            this.refreshSubject = new ReplaySubject<string | null>(1);
          },
          error: () => {
            this.refreshInProgress = false;
            this.refreshSubject = new ReplaySubject<string | null>(1);
          }
        })
      );

    return refresh$;
  }

}
