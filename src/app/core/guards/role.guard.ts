// src/app/core/guards/role.guard.ts
import {inject} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AuthService} from '../services/auth.service';
import {Role} from '../models/roles.model';

export function RoleGuard(allowedRoles: Role[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.ensureSessionReady().pipe(
      map(() => {
        if (!auth.isAuthenticated()) {
          return router.parseUrl(`/login?returnUrl=${encodeURIComponent(state.url)}`);
        }

        const role = auth.getUserRole();
        const ok = !!role && allowedRoles.includes(role);
        return ok ? true : router.parseUrl('/unauthorized');
      })
    );
  };
}
