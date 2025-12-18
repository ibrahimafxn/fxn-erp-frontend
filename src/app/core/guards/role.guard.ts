// src/app/core/guards/role.guard.ts
import {inject} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {AuthService} from '../services/auth.service';
import {Role} from '../models/roles.model';

export function RoleGuard(allowedRoles: Role[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // Pas connecté -> login + returnUrl
    if (!auth.isAuthenticated()) {
      return router.parseUrl(`/login?returnUrl=${encodeURIComponent(state.url)}`);
    }

    // Connecté mais rôle non autorisé
    const role = auth.getUserRole();
    const ok = !!role && allowedRoles.includes(role);

    return ok ? true : router.parseUrl('/unauthorized');
  };
}
