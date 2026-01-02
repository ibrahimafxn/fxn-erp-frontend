// dashboard.ts

import {Component, computed, inject, OnInit} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {Router, RouterModule} from '@angular/router';
import {AdminService} from '../../core/services/admin.service';
import {HistoryItem} from '../../core/models/historyItem.model';

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  imports: [CommonModule, RouterModule, DatePipe]
})
export class Dashboard implements OnInit {
  readonly adminService = inject(AdminService);
  private router = inject(Router);

  // On réexpose les signals du service pour les templates
  readonly stats = this.adminService.stats;       // Signal<DashboardStats | null>
  readonly loading = this.adminService.loading;   // Signal<boolean>
  readonly error = this.adminService.error;       // Signal<any | null>
  readonly historySignal = this.adminService.history; // Signal<HistoryItem[]>

  // Derniers mouvements (ex : 10 derniers)
  readonly recentHistory = computed(() => {
    const list = this.historySignal() || [];
    return list.slice(0, 10);
  });

  ngOnInit(): void {
    // Charge les stats du dashboard au chargement de la page
    this.adminService.loadDashboardStats();

    // Charge l'historique global (tu peux rajouter des filtres plus tard)
    this.adminService.refreshHistory({}, true).subscribe({
      error: () => {
        // l'erreur est déjà stockée dans le signal error(), rien à faire ici
      }
    });
  }

  // Navigation rapide depuis les cartes du dashboard
  goToUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  goToDepots(): void {
    this.router.navigate(['/admin/depots']);
  }

  goToResources(type?: 'materials' | 'consumables' | 'vehicles'): void {
    if (type) {
      this.router.navigate(['/admin/resources', type]);
    } else {
      this.router.navigate(['/admin/resources']);
    }
  }

  goToHistory(): void {
    this.router.navigate(['/admin/history']);
  }

  goToOnboarding(): void {
    this.router.navigate(['/admin/onboarding']);
  }

  goToStockAlerts(): void {
    this.router.navigate(['/admin/alerts/stock']);
  }

  trackHistory(index: number, item: HistoryItem): string {
    return (item as any).id || `${index}`;
  }
}
