// src/app/app.config.ts
import {Routes} from '@angular/router';
import {HTTP_INTERCEPTORS} from '@angular/common/http';

import {AuthGuard} from './core/guards/auth.guard';
import {RoleGuard} from './core/guards/role.guard';
import {AuthInterceptor} from './core/interceptors/auth.interceptor';
import {DEPOT_ROUTES} from './modules/depot/depot.routes';
import {ADMIN_ROUTES} from './admin/admin.routes';
import {Role} from './core/models/roles.model';

/**
 * AppConfig : centralise les routes et providers globaux
 */
export const AppConfig = {
  routes: <Routes>[
    // --- Page login accessible sans authentification ---
    {
      path: 'login',
      loadComponent: () =>
        import('./modules/auth/login/login').then(m => m.Login)
    },

    // --- Espace dépôt (gestion stock / techniciens) ---
    {
      path: 'depot',
      loadChildren: () => Promise.resolve(DEPOT_ROUTES),
      canActivate: [
        AuthGuard,
        RoleGuard([
          Role.GESTION_DEPOT,
          Role.TECHNICIEN,
          Role.ADMIN,
          Role.DIRIGEANT
        ])
      ]
    },

    // --- Espace administration (dirigeant + admin uniquement) ---
    {
      path: 'admin',
      loadChildren: () => Promise.resolve(ADMIN_ROUTES),
      canActivate: [
        AuthGuard,
        RoleGuard([Role.ADMIN, Role.DIRIGEANT])
      ]
    },

    {
      path: 'unauthorized',
      loadComponent: () =>
        import('./modules/shared/unauthorized/unauthorized').then(m => m.Unauthorized)
    },

    {
      path: '',
      canActivate: [AuthGuard],
      loadComponent: () =>
        import('./core/components/role-redirect/role-redirect').then(m => m.RoleRedirect)
    },

    // --- Page 404 fallback ---
    {
      path: '**',
      loadComponent: () =>
        import('./modules/shared/not-found/not-found').then(m => m.NotFound)
    }
  ],

  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ]
};
