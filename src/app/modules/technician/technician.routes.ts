import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/roles.model';

const TECHNICIAN_ACCESS = [Role.TECHNICIEN];

export const TECHNICIAN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./technician-dashboard/technician-dashboard').then(m => m.TechnicianDashboard),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/materials',
    loadComponent: () =>
      import('../../admin/resources/materials/material-list/material-list').then(m => m.MaterialList),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/materials/:id/detail',
    loadComponent: () =>
      import('../../admin/resources/materials/material-detail/material-detail').then(m => m.MaterialDetail),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/consumables',
    loadComponent: () =>
      import('../../admin/resources/consumables/consumable-list/consumable-list').then(m => m.ConsumableList),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/consumables/:id/detail',
    loadComponent: () =>
      import('../../admin/resources/consumables/consumable-detail/consumables-detail').then(m => m.ConsumablesDetail),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/vehicles',
    loadComponent: () =>
      import('../../admin/resources/vehicles/vehicle-list/vehicle-list').then(m => m.VehicleList),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/vehicles/:id/detail',
    loadComponent: () =>
      import('../../admin/resources/vehicles/vehicle-detail/vehicle-detail').then(m => m.VehicleDetail),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/vehicles/:id/breakdown',
    loadComponent: () =>
      import('../../admin/resources/vehicles/vehicle-breakdown/vehicle-breakdown').then(m => m.VehicleBreakdown),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'resources/vehicles/:id/breakdowns',
    loadComponent: () =>
      import('../../admin/resources/vehicles/vehicle-breakdowns/vehicle-breakdowns').then(m => m.VehicleBreakdowns),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./technician-reports/technician-reports').then(m => m.TechnicianReports),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'supply-requests',
    loadComponent: () =>
      import('./technician-supply-requests/technician-supply-requests').then(m => m.TechnicianSupplyRequests),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'agenda',
    loadComponent: () =>
      import('./technician-agenda/technician-agenda').then(m => m.TechnicianAgenda),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'revenue',
    loadComponent: () =>
      import('./technician-revenue/technician-revenue').then(m => m.TechnicianRevenue),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'charges',
    loadComponent: () =>
      import('./technician-charges/technician-charges').then(m => m.TechnicianCharges),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./technician-history/technician-history').then(m => m.TechnicianHistory),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'documents',
    loadComponent: () =>
      import('./technician-documents/technician-documents').then(m => m.TechnicianDocuments),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'bpu',
    loadComponent: () =>
      import('../../admin/bpu/bpu-list/bpu-list').then(m => m.BpuList),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  },
  {
    path: 'interventions',
    loadComponent: () =>
      import('./technician-interventions-history/technician-interventions-history')
        .then(m => m.TechnicianInterventionsHistory),
    canActivate: [AuthGuard, RoleGuard(TECHNICIAN_ACCESS)]
  }
];
