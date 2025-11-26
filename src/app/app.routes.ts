import { Routes } from '@angular/router';
import {ConsumablesList} from './admin/resources/consumables-list/consumables-list';
import {UserList} from './admin/users/user-list/user-list';
import {UserForm} from './admin/users/user-form/user-form';
import {UserDetail} from './admin/users/user-detail/user-detail';
import {DepotList} from './admin/depots/depot-list/depot-list';
import {MaterialsList} from './admin/resources/materials-list/materials-list';
import {VehiclesList} from './admin/resources/vehicles-list/vehicles-list';
import {HistoryList} from './admin/history/history-list/history-list';
import {AdminDashboard} from './admin/dashboard/admin-dashboard/admin-dashboard';

const routes: Routes = [
  { path: 'admin', component: AdminDashboard },
  { path: 'admin/users', component: UserList },
  { path: 'admin/users/new', component: UserForm },
  { path: 'admin/users/:id', component: UserDetail },
  { path: 'admin/depots', component: DepotList },
  { path: 'admin/resources/materials', component: MaterialsList },
  { path: 'admin/resources/vehicles', component: VehiclesList },
  { path: 'admin/resources/consumables', component: ConsumablesList },
  { path: 'admin/history', component: HistoryList },
];
