import { Component, signal, inject } from '@angular/core';
import {DepotService} from '../../core/services/depot.service';

interface DepotDashboardStats {
  totalAssigned: number;
  totalAvailable: number;
  totalVehicles: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent {

  private depotService = inject(DepotService);

  stats = signal<DepotDashboardStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    this.error.set(null);

    // ici getDepotStats retourne Observable<DepotDashboardStats>
    this.depotService.getDepotStats('someDepotId').subscribe({
      next: (data: DepotDashboardStats) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Erreur inconnue');
        this.loading.set(false);
      }
    });
  }

  refresh() {
    this.loadStats();
  }
}
