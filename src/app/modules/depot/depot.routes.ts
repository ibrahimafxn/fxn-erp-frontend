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
  },
  {
    path: 'resources/materials',
    loadComponent: () =>
      import('../../admin/resources/materials/material-list/material-list').then(m => m.MaterialList),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'resources/materials/:id/detail',
    loadComponent: () =>
      import('../../admin/resources/materials/material-detail/material-detail').then(m => m.MaterialDetail),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'resources/consumables',
    loadComponent: () =>
      import('../../admin/resources/consumables/consumable-list/consumable-list').then(m => m.ConsumableList),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'resources/consumables/:id/detail',
    loadComponent: () =>
      import('../../admin/resources/consumables/consumable-detail/consumables-detail').then(m => m.ConsumablesDetail),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'resources/vehicles',
    loadComponent: () =>
      import('../../admin/resources/vehicles/vehicle-list/vehicle-list').then(m => m.VehicleList),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'resources/vehicles/:id/detail',
    loadComponent: () =>
      import('../../admin/resources/vehicles/vehicle-detail/vehicle-detail').then(m => m.VehicleDetail),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'history',
    loadComponent: () =>
      import('../../admin/history/history-list/history-list').then(m => m.HistoryList),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'reservations',
    loadComponent: () =>
      import('../../admin/reservations/reservations-list/reservations-list').then(m => m.ReservationsList),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'receipts',
    loadComponent: () =>
      import('../../admin/receipts/receipt-page/receipt-page').then(m => m.ReceiptPage),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  },
  {
    path: 'alerts/stock',
    loadComponent: () =>
      import('../../admin/alerts/stock-alerts/stock-alerts').then(m => m.StockAlerts),
    canActivate: [
      AuthGuard,
      RoleGuard([Role.GESTION_DEPOT])
    ]
  }
];
