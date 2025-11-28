// src/app/core/services/auth.service.ts
import { Injectable, signal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  filter,
  map,
  of,
  ReplaySubject,
  take,
  tap,
  throwError
} from 'rxjs';

/**
 * AuthService
 *
 * - Stocke accessToken / refreshToken (par défaut localStorage)
 * - Expose isAuthenticated signal pour Angular 20
 * - Expose isLoggedIn() sync pour guards simples
 * - Implémente refreshToken() mutualisé pour éviter plusieurs refresh simultanés
 *
 * Requirements (backend):
 * - POST  /auth/login      -> { accessToken, refreshToken, user? }
 * - POST  /auth/refresh    -> { accessToken, refreshToken? }
 * - POST  /auth/logout     -> (optionnel)
 *
 * NOTE de sécurité :
 * - localStorage est simple mais sujet XSS. Préfère HttpOnly cookies côté backend
 *   si possible (requiert adaptation de l'interceptor et du backend).
 */

const API_BASE = 'http://localhost:5000/api';

const LS_KEY_ACCESS = 'fxn_access_token';
const LS_KEY_REFRESH = 'fxn_refresh_token';
const LS_KEY_USER = 'fxn_user'; // optionnel : stockage info public user (non sensible)

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user?: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // --- Signals + observables pour interface reactive ---
  private _isAuthenticated = signal<boolean>(false);
  readonly isAuthenticated: Signal<boolean> = this._isAuthenticated.asReadonly();

  // userInfo optional (minimal public info)
  private _user$ = new BehaviorSubject<any | null>(this._loadStoredUser());
  readonly user$ = this._user$.asObservable();

  // --- Refresh mutualisation ---
  // Lorsqu'un refresh est en cours, on réémet le nouveau accessToken via ce subject
  // ReplaySubject(1) permet aux nouveaux subscribers de recevoir la valeur si déjà émise.
  private refreshInProgress = false;
  private refreshSubject = new ReplaySubject<string | null>(1);

  constructor(private http: HttpClient, private router: Router) {
    // Initialise le signal isAuthenticated sur la base des tokens existants
    this._isAuthenticated.set(!!this.getAccessToken() && !this.isTokenExpired(this.getAccessToken()));
  }

  // ---------------------------
  // Storage helpers (abstraits pour faciliter le swap)
  // ---------------------------
  getAccessToken(): string | null {
    return localStorage.getItem(LS_KEY_ACCESS);
  }

  setAccessToken(token: string | null): void {
    if (token) {
      localStorage.setItem(LS_KEY_ACCESS, token);
    } else {
      localStorage.removeItem(LS_KEY_ACCESS);
    }
    // met à jour le signal d'auth
    this._isAuthenticated.set(!!token && !this.isTokenExpired(token));
  }

  protected getRefreshToken(): string | null {
    return localStorage.getItem(LS_KEY_REFRESH);
  }

  protected setRefreshToken(token: string | null): void {
    if (token) {
      localStorage.setItem(LS_KEY_REFRESH, token);
    } else {
      localStorage.removeItem(LS_KEY_REFRESH);
    }
  }

  protected storeUser(user: any | null): void {
    if (user) {
      try {
        localStorage.setItem(LS_KEY_USER, JSON.stringify(user));
      } catch {
        localStorage.removeItem(LS_KEY_USER);
      }
      this._user$.next(user);
    } else {
      localStorage.removeItem(LS_KEY_USER);
      this._user$.next(null);
    }
  }

  protected _loadStoredUser(): any | null {
    try {
      const raw = localStorage.getItem(LS_KEY_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ---------------------------
  // Public API
  // ---------------------------

  /**
   * login(credentials) -> enregistre tokens si succès
   * Exemple credentials: { username, password } ou { email, password }
   */
  login(credentials: any) {
    return this.http.post<LoginResponse>(`${API_BASE}/auth/login`, credentials).pipe(
      tap(resp => {
        if (!resp || !resp.accessToken) {
          throw new Error('Réponse login invalide : accessToken manquant');
        }
        this.setAccessToken(resp.accessToken);
        if (resp.refreshToken) this.setRefreshToken(resp.refreshToken);
        if (resp.user) this.storeUser(resp.user);
      }),
      catchError(err => {
        // ne pas changer l'état local ici, laisser appelant gérer l'affichage d'erreur
        return throwError(() => err);
      })
    );
  }

  /**
   * logout: nettoie le stockage local et navigue vers /login
   * appelle backend logout si disponible (optionnel)
   */
  logout(redirect = true) {
    // appel backend optionnel, ignore erreurs
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // on déclenche le call mais on ne le bloque pas
      this.http.post(`${API_BASE}/auth/logout`, { token: refreshToken }).pipe(
        catchError(() => of(null))
      ).subscribe({ next: () => {}, error: () => {} });
    }

    // nettoyage local
    this.setAccessToken(null);
    this.setRefreshToken(null);
    this.storeUser(null);

    // réinitialise refreshSubject pour futurs refresh (sécurité)
    this.refreshInProgress = false;
    this.refreshSubject = new ReplaySubject<string | null>(1);

    if (redirect) {
      // navigue vers login
      this.router.navigate(['/login']);
    }
  }

  /**
   * isLoggedIn(): boolean sync
   * Guards simples peuvent utiliser cette méthode.
   */
  isLoggedIn(): boolean {
    const t = this.getAccessToken();
    return !!t && !this.isTokenExpired(t);
  }

  /**
   * Retourne role depuis le token (si présent) ou depuis user$ si stocké.
   */
  getUserRole(): string | null {
    const token = this.getAccessToken();
    if (token) {
      const claims = this.decodeJwt(token);
      if (claims && (claims.role || claims.roles || claims.roles?.[0])) {
        // s'adapte à différentes formes de claim
        // role: "ADMIN" OR roles: ["ADMIN"]
        if (Array.isArray(claims.roles) && claims.roles.length) return String(claims.roles[0]);
        return String(claims.role || claims.roles);
      }
    }

    const user = this._user$.value;
    if (user && user.role) return String(user.role);

    return null;
  }

  /**
   * getUserId() : retourne idUser si présent dans le token
   */
  getUserId(): string | null {
    const token = this.getAccessToken();
    if (!token) return this._user$.value?.idUser ?? null;
    const claims = this.decodeJwt(token);
    return claims?.sub ?? claims?.id ?? claims?.userId ?? null;
  }

  /**
   * refreshToken() mutualisé :
   * - si un refresh est déjà en cours => retourne l'observable qui émettra le nouveau token
   * - sinon lance la requête /auth/refresh et émet le nouveau token
   *
   * Renvoie: Observable<string> qui émet le nouveau accessToken (ou error si échec)
   */
  refreshToken() {
    const existingRefreshToken = this.getRefreshToken();
    if (!existingRefreshToken) {
      // pas de refresh token -> force logout
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    // Si déjà en cours, retourner le subject pour souscrire au résultat
    if (this.refreshInProgress) {
      return this.refreshSubject.asObservable().pipe(
        filter((t): t is string => !!t),
        take(1)
      );
    }

    // Marque un refresh en cours
    this.refreshInProgress = true;

    // Lancer requête de refresh
    const call$ = this.http.post<LoginResponse>(`${API_BASE}/auth/refresh`, { token: existingRefreshToken }).pipe(
      tap(resp => {
        if (!resp || !resp.accessToken) {
          throw new Error('Réponse refresh invalide : accessToken manquant');
        }
        // enregistre tokens
        this.setAccessToken(resp.accessToken);
        if (resp.refreshToken) this.setRefreshToken(resp.refreshToken);
        // optionnel: mise à jour user si fournie
        if (resp.user) this.storeUser(resp.user);

        // notifie les abonnés
        this.refreshSubject.next(resp.accessToken);
      }),
      map(resp => resp.accessToken),
      catchError(err => {
        // notifie l'échec aux abonnés puis logout
        this.refreshSubject.next(null);
        this.logout(true);
        return throwError(() => err);
      }),
      tap(() => {
        // réinitialise l'état
        this.refreshInProgress = false;
        // récrée un nouveau subject prêt pour les futurs refresh
        this.refreshSubject = new ReplaySubject<string | null>(1);
      })
    );

    return call$;
  }

  // ---------------------------
  // JWT Helpers
  // ---------------------------

  /**
   * decodeJwt(token) -> parse base64 payload JSON (sans validation cryptographique)
   * Retourne les claims (object) ou null si invalide.
   */
  decodeJwt(token: string | null) {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = parts[1];
      // add padding for base64 if necessary
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const json = atob(padded);
      return JSON.parse(json);
    } catch (err) {
      console.warn('decodeJwt failed', err);
      return null;
    }
  }

  /**
   * isTokenExpired(token) -> boolean
   * lit claim `exp` et compare à Date.now()/1000
   */
  isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    const claims = this.decodeJwt(token);
    if (!claims) return true;
    if (!claims.exp) return false; // si pas d'exp on considère non-expiré (optionnel)
    const exp = Number(claims.exp);
    if (isNaN(exp)) return false;
    // exp est en secondes unix
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= exp;
  }

  // ---------------------------
  // Utility: for tests / dev
  // ---------------------------
  /**
   * Force-set tokens (utile pour tests)
   */
  __forceSetTokens(access: string | null, refresh: string | null) {
    this.setAccessToken(access);
    this.setRefreshToken(refresh);
  }
}
