import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';

/**
 * Exporte ADMIN_ROUTES pour être utilisé dans AppConfig:
 * { path: 'admin', loadChildren: () => import('./modules/admin/admin.routes').then(m => m.ADMIN_ROUTES) }
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout/admin-layout').then(m => m.AdminLayout),
    canActivate: [AuthGuard, () => RoleGuard(['ADMIN','DIRIGEANT'])],
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      {
        path: 'users',
        // Si tu as déjà un UserListComponent standalone, remplace la ligne ci-dessous par le chemin de ton composant réel
        loadComponent: () => import('./admin-users/admin-users').then(m => m.AdminUsers)
        // ou par: loadComponent: () => import('../user/user-list.component').then(m => m.UserListComponent)
      },
      {
        path: 'depots',
        loadComponent: () => import('./admin-depots/admin-depots').then(m => m.AdminDepots)
        // ou: loadComponent: () => import('../depot/depot-list.component').then(m => m.DepotListComponent)
      },
      {
        path: 'tools',
        loadComponent: () => import('../tool/tool-list/tool-list').then(m => m.ToolList)
      },
      {
        path: 'vehicles',
        loadComponent: () => import('../vehicle/vehicle-list/vehicle-list').then(m => m.VehicleList)
      }
    ]
  }
];
