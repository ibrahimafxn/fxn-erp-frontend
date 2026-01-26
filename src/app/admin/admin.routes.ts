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
  {
    path: 'onboarding',
    loadComponent: () => import('./onboarding/onboarding').then(m => m.Onboarding)
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
  {
    path: 'reservations',
    loadComponent: () => import('./reservations/reservations-list/reservations-list').then(m => m.ReservationsList)
  },
  {
    path: 'reservations/materials',
    loadComponent: () =>
      import('./reservations/material-reservations/material-reservations-list').then(m => m.MaterialReservationsList)
  },
  {
    path: 'receipts',
    loadComponent: () => import('./receipts/receipt-page/receipt-page').then(m => m.ReceiptPage)
  },
  {
    path: 'orders',
    loadComponent: () => import('./orders/orders-page/orders-page').then(m => m.OrdersPage)
  },
  {
    path: 'orders/new',
    loadComponent: () => import('./orders/order-form/order-form').then(m => m.OrderForm)
  },
  {
    path: 'orders/:id/edit',
    loadComponent: () => import('./orders/order-form/order-form').then(m => m.OrderForm)
  },
  {
    path: 'orders/:id/detail',
    loadComponent: () => import('./orders/order-detail/order-detail').then(m => m.OrderDetail)
  },
  {
    path: 'alerts/stock',
    loadComponent: () => import('./alerts/stock-alerts/stock-alerts').then(m => m.StockAlerts)
  },
  {
    path: 'interventions',
    loadComponent: () =>
      import('./interventions/interventions-dashboard/interventions-dashboard').then(m => m.InterventionsDashboard)
  },
  {
    path: 'bpu',
    loadComponent: () => import('./bpu/bpu-type-list/bpu-type-list').then(m => m.BpuTypeList)
  },
  {
    path: 'bpu/new',
    loadComponent: () => import('./bpu/bpu-type-form/bpu-type-form').then(m => m.BpuTypeForm)
  },
  {
    path: 'bpu/:id/edit',
    loadComponent: () => import('./bpu/bpu-type-form/bpu-type-form').then(m => m.BpuTypeForm)
  },
  {
    path: 'revenue',
    loadComponent: () =>
      import('./revenue/revenue-dashboard/revenue-dashboard').then(m => m.RevenueDashboard)
  },

  // -----------------------------
  // MATERIALS
  // -----------------------------

  // /admin/resources/materials
  {
    path: 'resources/materials',
    loadComponent: () =>
      import('./resources/materials/material-list/material-list').then(m => m.MaterialList)
  },
  // /admin/resources/materials/new
  {
    path: 'resources/materials/new',
    loadComponent: () =>
      import('./resources/materials/material-form/material-form').then(m => m.MaterialForm)
  },
  // /admin/resources/materials/:id
  {
    path: 'resources/materials/:id',
    loadComponent: () =>
      import('./resources/materials/material-detail/material-detail').then(m => m.MaterialDetail)
  },
  // /admin/resources/materials/:id/edit
  {
    path: 'resources/materials/:id/edit',
    loadComponent: () =>
      import('./resources/materials/material-form/material-form').then(m => m.MaterialForm)
  },


  // -----------------------------
  // CONSUMABLES
  // -----------------------------

  {
    path: 'resources/consumables',
    loadComponent: () =>
      import('./resources/consumables/consumable-list/consumable-list').then(m => m.ConsumableList)
  },
  {
    path: 'resources/consumables/new',
    loadComponent: () =>
      import('./resources/consumables/consumable-form/consumables-form').then(m => m.ConsumablesForm)
  },
  {
    path: 'resources/consumables/:id',
    loadComponent: () =>
      import('./resources/consumables/consumable-detail/consumables-detail').then(m => m.ConsumablesDetail)
  },
  {
    path: 'resources/consumables/:id/edit',
    loadComponent: () =>
      import('./resources/consumables/consumable-form/consumables-form').then(m => m.ConsumablesForm)
  },


  // -----------------------------
  // VEHICLES
  // -----------------------------
// /admin/resources/vehicles
  {
    path: 'resources/vehicles',
    loadComponent: () =>
      import('./resources/vehicles/vehicle-list/vehicle-list').then(m => m.VehicleList)
  },

// /admin/resources/vehicles/new
  {
    path: 'resources/vehicles/new',
    loadComponent: () =>
      import('./resources/vehicles/vehicle-form/vehicle-form').then(m => m.VehicleForm)
  },

// /admin/resources/vehicles/:id/edit
  {
    path: 'resources/vehicles/:id/edit',
    loadComponent: () =>
      import('./resources/vehicles/vehicle-form/vehicle-form').then(m => m.VehicleForm)
  },

// /admin/resources/vehicles/:id/detail
  {
    path: 'resources/vehicles/:id/detail',
    loadComponent: () =>
      import('./resources/vehicles/vehicle-detail/vehicle-detail').then(m => m.VehicleDetail)
  },
  {
    path: 'resources/vehicles/:id/breakdown',
    loadComponent: () =>
      import('./resources/vehicles/vehicle-breakdown/vehicle-breakdown').then(m => m.VehicleBreakdown)
  },
  {
    path: 'resources/vehicles/:id/breakdowns',
    loadComponent: () =>
      import('./resources/vehicles/vehicle-breakdowns/vehicle-breakdowns').then(m => m.VehicleBreakdowns)
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

  {
    path: 'security/user-access',
    loadComponent: () => import('./security/access-users/access-users').then(m => m.AccessUsers),
  },
  {
    path: 'hr',
    loadComponent: () => import('../modules/hr/hr-list/hr-list').then(m => m.HrList)
  },
  {
    path: 'technicians/activity',
    loadComponent: () =>
      import('./technicians/technician-activity/technician-activity').then(m => m.TechnicianActivity)
  }

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
