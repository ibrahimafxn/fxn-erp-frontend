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

  // -----------------------------
  // DEPOTS
  // -----------------------------

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
  // /admin/depots/:id (édition)
  {
    path: 'depots/:id/edit',
    loadComponent: () => import('./depots/depot-form/depot-form').then(m => m.DepotForm)
  },
  // /admin/depots/:id/view (détail)
  {
    path: 'depots/:id/detail',
    loadComponent: () => import('./depots/depot-detail/depot-detail').then(m => m.DepotDetail)
  },

  // -----------------------------
  // HISTORY
  // -----------------------------

  {
    path: 'history',
    loadComponent: () => import('./history/history-list/history-list').then(m => m.HistoryList)
  },

  // -----------------------------
  // MATERIALS
  // -----------------------------

  // /admin/resources/materials
  {
    path: 'resources/materials',
    loadComponent: () =>
      import('./resources/materials/materials-list/materials-list').then(m => m.MaterialsList)
  },
  // /admin/resources/materials/new
  {
    path: 'resources/materials/new',
    loadComponent: () =>
      import('./resources/materials/materials-form/materials-form').then(m => m.MaterialsForm)
  },
  // /admin/resources/materials/:id
  {
    path: 'resources/materials/:id',
    loadComponent: () =>
      import('./resources/materials/materials-detail/materials-detail').then(m => m.MaterialsDetail)
  },
  // /admin/resources/materials/:id/edit
  {
    path: 'resources/materials/:id/edit',
    loadComponent: () =>
      import('./resources/materials/materials-form/materials-form').then(m => m.MaterialsForm)
  },


  // -----------------------------
  // CONSUMABLES
  // -----------------------------

  {
    path: 'resources/consumables',
    loadComponent: () =>
      import('./resources/consumables/consumables-list/consumables-list').then(m => m.ConsumablesList)
  },
  {
    path: 'resources/consumables/new',
    loadComponent: () =>
      import('./resources/consumables/consumables-form/consumables-form').then(m => m.ConsumablesForm)
  },
  {
    path: 'resources/consumables/:id',
    loadComponent: () =>
      import('./resources/consumables/consumables-detail/consumables-detail').then(m => m.ConsumablesDetail)
  },
  {
    path: 'resources/consumables/:id/edit',
    loadComponent: () =>
      import('./resources/consumables/consumables-form/consumables-form').then(m => m.ConsumablesForm)
  },


  // -----------------------------
  // VEHICLES
  // -----------------------------

  {
    path: 'resources/vehicles',
    loadComponent: () =>
      import('./resources/vehicles-list/vehicles-list').then(m => m.VehiclesList)
  },


  // -----------------------------
  // USERS
  // -----------------------------

  // liste
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
    path: 'users/:id/detail',
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
