import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;

  constructor(private auth: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getAccessToken();
    let authReq = req;
    if (token) {
      authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }

    return next.handle(authReq).pipe(
      catchError((err: any) => {
        if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith('/auth/refresh')) {
          // attempt refresh once
          if (!this.isRefreshing) {
            this.isRefreshing = true;
            return this.auth.refresh().pipe(
              switchMap((resp: any) => {
                this.isRefreshing = false;
                const newToken = this.auth.getAccessToken();
                const retryReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
                return next.handle(retryReq);
              }),
              catchError(refreshErr => {
                this.isRefreshing = false;
                this.auth.logout().subscribe(() => {
                  this.router.navigate(['/login']);
                });
                return throwError(() => refreshErr);
              })
            );
          }
        }
        return throwError(() => err);
      })
    );
  }
}
