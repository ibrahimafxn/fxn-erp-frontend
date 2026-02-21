// src/app/core/interceptors/auth.interceptor.ts
import {inject, Injectable} from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, switchMap} from 'rxjs/operators';
import {AuthService} from '../services/auth.service';
import {environment} from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private auth = inject(AuthService);
  private readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const cookie of cookies) {
      const [key, ...rest] = cookie.trim().split('=');
      if (key === name) {
        return decodeURIComponent(rest.join('='));
      }
    }
    return null;
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // 1) Ne pas toucher les requêtes vers des domaines externes
    const apiBase = environment.apiBaseUrl?.replace(/\/+$/, '') || '';
    const isApiReq = !req.url.startsWith('http') || req.url.startsWith(apiBase);

    // 2) Pour les requêtes API internes : avecCredentials + CSRF pour les mutations
    let authReq = req;
    if (isApiReq) {
      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
      const csrfToken = isMutation ? this.readCookie('XSRF-TOKEN') : null;
      const headers = csrfToken && !req.headers.has('X-XSRF-TOKEN')
        ? req.headers.set('X-XSRF-TOKEN', csrfToken)
        : req.headers;
      authReq = req.clone({ headers, withCredentials: true });
    }

    // 3) Passer la requête
    return next.handle(authReq).pipe(
      catchError((err: any) => {
        // gestion 401 uniquement pour requêtes API internes
        if (err instanceof HttpErrorResponse && err.status === 401 && isApiReq) {
          // éviter boucle si on est déjà sur refresh/login
          const url = req.url.split('?')[0]; // ignore query params
          const isRefreshOrLogin = url.includes('/auth/refresh') || url.includes('/auth/login');
          if (isRefreshOrLogin) {
            // logout + laisser l'erreur remonter
            this.auth.logout(true);
            return throwError(() => err);
          }

          // tenter refresh (AuthService doit mutualiser les requêtes)
          return this.auth.refreshToken().pipe(
            switchMap(() => next.handle(authReq)),
            catchError(refreshErr => {
              // refresh KO -> logout et rethrow
              this.auth.logout(true);
              return throwError(() => refreshErr);
            })
          );
        }

        // pour tous les autres cas, ré-émettre l'erreur
        return throwError(() => err);
      })
    );
  }
}
