// src/app/core/guards/role.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { from, map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export function RoleGuard(requiredRoles: string[] = []): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const normalize = (r?: string) => (r || '').toString().toUpperCase();
    const unauthorized = () => router.parseUrl('/forbidden');

    const checkRole = (isLogged: boolean) => {
      if (!isLogged) return router.parseUrl(`/login?returnUrl=${encodeURIComponent(router.url || '/')}`);

      const userRole = auth.getUserRole();
      if (!userRole) return unauthorized();

      const allowed = requiredRoles.map(normalize);
      if (allowed.includes(normalize(userRole))) return true;
      return unauthorized();
    };

    const res = auth.isLoggedIn();
    if (typeof res === 'boolean') return checkRole(res);
    return from(res as Promise<boolean>).pipe(map(checkRole));
  };
}
