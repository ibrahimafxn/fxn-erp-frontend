import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

export const AppConfig = {

  routes: <Routes>[
    {
      path: '',
      loadComponent: () =>
        import('./modules/dashboard/dashboard/dashboard')
          .then(m => m.Dashboard),
      canActivate: [AuthGuard]
    },
    {
      path: 'login',
      loadComponent: () =>
        import('./modules/auth/login/login')
          .then(m => m.Login)
    },
    {
      path: 'admin',
      canActivate: [AuthGuard, RoleGuard(['admin'])],
      loadChildren: () =>
        import('./modules/admin/admin.routes')
          .then(m => m.ADMIN_ROUTES)
    }
  ],

  providers: [
    // si tu as des injections globales plus tard
  ]
};
