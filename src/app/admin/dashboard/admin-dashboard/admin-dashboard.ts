// admin-dashboard.component.ts
import { Component, inject } from '@angular/core';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboard {
  private adminService = inject(AdminService);

  // on expose des "fonctions signal" pour le template
  stats = () => this.adminService.stats();
  loading = () => this.adminService.loading();
  error = () => this.adminService.error();

  constructor() {
    // charger les stats au montage du composant
    this.adminService.loadDashboardStats();
  }

  // action utilisateur pour forcer le rechargement
  refresh(): void {
    this.adminService.loadDashboardStats();
  }
}
