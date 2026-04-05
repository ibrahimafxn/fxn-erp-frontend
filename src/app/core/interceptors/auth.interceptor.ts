// src/app/core/interceptors/auth.interceptor.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { throwError, TimeoutError } from 'rxjs';
import { catchError, switchMap, timeout } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

const HTTP_TIMEOUT_MS = 30_000;

function readCookie(name: string): string | null {
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

function isApiRequest(url: string, apiBase: string): boolean {
  // relative URL -> API interne
  if (!url.startsWith('http')) return true;

  // si apiBase non défini, ne pas deviner
  if (!apiBase) return false;

  // match direct (inclut /api)
  if (url.startsWith(apiBase)) return true;

  // fallback: même origin + même prefix /api (tolérant aux variations)
  try {
    const reqUrl = new URL(url);
    const baseUrl = new URL(apiBase);
    if (reqUrl.origin !== baseUrl.origin) return false;
    const basePath = baseUrl.pathname.replace(/\/+$/, '');
    if (!basePath) return false;
    return reqUrl.pathname.startsWith(basePath);
  } catch {
    return false;
  }
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // 1) Ne pas toucher les requêtes vers des domaines externes
  const apiBase = environment.apiBaseUrl?.replace(/\/+$/, '') || '';
  const isApiReq = isApiRequest(req.url, apiBase);

  // 2) Pour les requêtes API internes : withCredentials + CSRF pour les mutations
  let authReq = req;
  if (isApiReq) {
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
    const csrfToken = isMutation ? (readCookie('XSRF-TOKEN') || auth.getCsrfToken()) : null;
    const headers = csrfToken && !req.headers.has('X-XSRF-TOKEN')
      ? req.headers.set('X-XSRF-TOKEN', csrfToken)
      : req.headers;
    authReq = req.clone({ headers, withCredentials: true });
  }

  // 3) Passer la requête avec timeout
  return next(authReq).pipe(
    timeout(HTTP_TIMEOUT_MS),
    catchError((err: unknown) => {
      // Timeout dépassé
      if (err instanceof TimeoutError) {
        return throwError(() => new HttpErrorResponse({
          error: { success: false, message: 'La requête a expiré. Vérifiez votre connexion.' },
          status: 408,
          statusText: 'Request Timeout',
          url: req.url
        }));
      }

      if (err instanceof HttpErrorResponse && isApiReq) {
        const url = req.url.split('?')[0];
        const isRefreshOrLogin = url.includes('/auth/refresh') || url.includes('/auth/login');

        // 401 : tentative de refresh
        if (err.status === 401) {
          if (isRefreshOrLogin) {
            auth.logout(true);
            return throwError(() => err);
          }
          return auth.refreshToken().pipe(
            switchMap(() => next(authReq)),
            catchError(refreshErr => {
              auth.logout(true);
              return throwError(() => refreshErr);
            })
          );
        }

        // 403 : accès interdit → redirection (sauf endpoints auth/flux mdp)
        if (err.status === 403) {
          const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/change-password');
          const isPasswordFlow = !!(err.error && (err.error.passwordExpired || err.error.mustChangePassword));
          if (!isAuthEndpoint && !isPasswordFlow) {
            router.navigate(['/unauthorized']);
          }
        }
      }

      return throwError(() => err);
    })
  );
};
