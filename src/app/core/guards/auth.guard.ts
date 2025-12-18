// src/app/core/guards/auth.guard.ts
import {inject} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {AuthService} from '../services/auth.service';

export const AuthGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isLoggedIn = auth.isAuthenticated();
  return isLoggedIn ? true : router.parseUrl(`/login?returnUrl=${encodeURIComponent(state.url)}`);
};
