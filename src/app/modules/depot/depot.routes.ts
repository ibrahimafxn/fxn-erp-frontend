// src/app/modules/depot/depot.routes.ts
import {Routes} from '@angular/router';
import {AuthGuard} from '../../core/guards/auth.guard';
import {RoleGuard} from '../../core/guards/role.guard';
import {Role} from '../../core/models/roles.model';

/**
 * Routes pour le gestionnaire de dépôt
 * - Dashboard principal du dépôt
 * - Accessible aux utilisateurs avec le rôle GESTION_DEPOT (et éventuellement d'autres)
 */
export const DEPOT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./depot-dashboard/depot-dashboard').then(m => m.DepotDashboard),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])  // ✅ enum, plus de lambda, plus de string brute
      // tu peux aussi ouvrir aux techniciens si tu veux :
      // RoleGuard([Role.GESTION_DEPOT, Role.TECHNICIEN])
    ]
  }
];
