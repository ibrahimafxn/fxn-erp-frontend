// src/app/admin/admin.routes.ts
import { Routes } from '@angular/router';

/**
 * Routes de la zone admin.
 *
 * La protection AuthGuard + RoleGuard([ADMIN, DIRIGEANT])
 * est déjà appliquée sur le path 'admin' dans app.config.ts.
 * Ici on ne gère que la navigation interne.
 */
export const ADMIN_ROUTES: Routes = [
  // /admin -> /admin/dashboard
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },

  // /admin/dashboard
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard)
  },

  // /admin/depots
  {
    path: 'depots',
    loadComponent: () => import('./depots/depot-list/depot-list').then(m => m.DepotList)
  },

  // /admin/depots/new
  {
    path: 'depots/new',
    loadComponent: () => import('./depots/depot-form/depot-form').then(m => m.DepotForm)
  },

  // /admin/depots/:id
  {
    path: 'depots/:id',
    loadComponent: () => import('./depots/depot-form/depot-form').then(m => m.DepotForm)
  },

  // /admin/history
  {
    path: 'history',
    loadComponent: () => import('./history/history-list/history-list').then(m => m.HistoryList)
  },

  // /admin/resources/materials
  {
    path: 'resources/materials',
    loadComponent: () =>
      import('./resources/materials-list/materials-list').then(m => m.MaterialsList)
  },

  // /admin/resources/consumables
  {
    path: 'resources/consumables',
    loadComponent: () =>
      import('./resources/consumables-list/consumables-list').then(m => m.ConsumablesList)
  },

  // /admin/resources/vehicles
  {
    path: 'resources/vehicles',
    loadComponent: () =>
      import('./resources/vehicles-list/vehicles-list').then(m => m.VehiclesList)
  },

  // -----------------------------
  // USERS
  // -----------------------------

  // /admin/users (liste)
  {
    path: 'users',
    loadComponent: () => import('./users/user-list/user-list').then(m => m.UserList)
  },

  // /admin/users/new (création)
  {
    path: 'users/new',
    loadComponent: () => import('./users/user-form/user-form').then(m => m.UserForm)
  },

  // /admin/users/:id (détail)
  {
    path: 'users/:id',
    loadComponent: () => import('./users/user-detail/user-detail').then(m => m.UserDetail)
  },

  // /admin/users/:id/edit (édition)
  {
    path: 'users/:id/edit',
    loadComponent: () => import('./users/user-form/user-form').then(m => m.UserForm)
  },

  // Optionnel (on fera après)
  // {
  //   path: 'users/:id/access',
  //   loadComponent: () => import('./users/user-access/user-access').then(m => m.UserAccess)
  // },
  // {
  //   path: 'users/:id/password',
  //   loadComponent: () => import('./users/user-password/user-password').then(m => m.UserPassword)
  // }
];
