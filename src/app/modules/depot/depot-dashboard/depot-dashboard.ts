// src/app/modules/depot/depot-dashboard/depot-dashboard.ts
import {Component, inject, signal} from '@angular/core';
import {DepotService} from '../../../core/services/depot.service';
import {AuthService} from '../../../core/services/auth.service';
import {MatCard, MatCardContent, MatCardTitle} from '@angular/material/card';
import {MatButton} from '@angular/material/button';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {DepotDashboardStats} from '../../../core/models/DepotDashboardStats';

@Component({
  selector: 'app-depot-dashboard',
  standalone: true,
  templateUrl: './depot-dashboard.html',
  styleUrls: ['./depot-dashboard.scss'],
  imports: [
    MatProgressSpinner,
    MatCard,
    MatCardContent,
    MatCardTitle,
    MatButton
  ]
})
export class DepotDashboard {

  // Injection services
  private depotService = inject(DepotService);
  private auth = inject(AuthService);

  // --- Signaux ---
  stats = signal<DepotDashboardStats | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  constructor() {
    // Charger les stats au montage
    this.loadStats();
  }

  // --- Charger les stats depuis le service ---
  loadStats(): void {
    const user = this.auth.getCurrentUser();
    const depotId = user?.idDepot;

    if (!depotId) {
      this.error.set("Utilisateur sans dépôt associé.");
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    this.depotService.loadStats(depotId).subscribe();
  }

  // --- Action utilisateur pour rafraîchir ---
  refresh(): void {
    this.loadStats();
  }
}
