// src/app/core/interceptors/auth.interceptor.ts
import {inject, Injectable} from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, switchMap} from 'rxjs/operators';
import {AuthService} from '../services/auth.service';
import {Router} from '@angular/router';
import {environment} from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private auth = inject(AuthService);
  private router = inject(Router);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // 1) Ne pas toucher les requêtes vers des domaines externes
    const apiBase = environment.apiBaseUrl?.replace(/\/+$/, '') || '';
    const isApiReq = !req.url.startsWith('http') || req.url.startsWith(apiBase);

    // 2) N'ajouter le header que pour les requêtes API internes
    const token = isApiReq ? this.auth.getAccessToken() : null;
    let authReq = req;
    if (token) {
      authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
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
            switchMap((newToken: string) => {
              if (!newToken) {
                // pas de token => logout
                this.auth.logout(true);
                return throwError(() => err);
              }
              const retryReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
              return next.handle(retryReq);
            }),
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
