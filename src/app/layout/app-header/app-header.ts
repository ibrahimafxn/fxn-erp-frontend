import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, AuthUser } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';
import { formatPersonName } from '../../core/utils/text-format';
import { AlertsService } from '../../core/services/alerts.service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, RouterModule, MatButtonModule],
  templateUrl: './app-header.html',
  styleUrls: ['./app-header.scss'],
})
export class AppHeader {
  private auth = inject(AuthService);
  private router = inject(Router);
  private alertsService = inject(AlertsService);

  // user
  readonly user = this.auth.user$;

  // menu state
  readonly menuOpen = signal(false);

  // breadcrumb label simple (V2)
  readonly pageTitle = signal('Dashboard');
  readonly alertsCount = this.alertsService.count;
  readonly showDirigeantWelcome = signal(false);
  private welcomeShown = false;
  private welcomeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.pageTitle.set(this.computeTitle(this.router.url));
        this.menuOpen.set(false);
        this.alertsService.refresh();
      });
    this.alertsService.refresh();
    effect(() => {
      const user = this.user();
      if (user?.role === 'DIRIGEANT') {
        this.triggerDirigeantWelcome();
      } else {
        this.showDirigeantWelcome.set(false);
      }
    });
  }

  /* ---------------------------
   * Computed user helpers
   * --------------------------- */

  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    return formatPersonName(u.firstName ?? '', u.lastName ?? '') || '';
  });

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  });

  readonly avatarUrl = computed(() => {
    const u = this.user();
    return u?.photoUrl || u?.avatarUrl || '';
  });

  readonly roleLabel = computed(() => {
    switch (this.user()?.role) {
      case 'DIRIGEANT': return 'Dirigeant';
      case 'ADMIN': return 'Administrateur';
      case 'GESTION_DEPOT': return 'Gestion dépôt';
      case 'TECHNICIEN': return 'Technicien';
      default: return '';
    }
  });

  readonly isDepotManager = computed(() => this.user()?.role === 'GESTION_DEPOT');

  readonly canManageAccess = computed(() => {
    const role = this.user()?.role;
    return role === 'DIRIGEANT' || role === 'ADMIN';
  });

  readonly canViewHr = computed(() => this.canManageAccess());
  readonly canViewMovements = computed(() => this.canManageAccess() || this.isDepotManager());
  readonly canViewInterventions = computed(() => this.canManageAccess());
  readonly canViewMaterialReservations = computed(() => this.canManageAccess());
  readonly dashboardLink = computed(() => (this.isDepotManager() ? '/depot' : '/admin/dashboard'));
  readonly movementsLink = computed(() => (this.isDepotManager() ? '/depot/history' : '/admin/history'));
  readonly reservationsLink = computed(() => (this.isDepotManager() ? '/depot/reservations' : '/admin/reservations'));
  readonly materialReservationsLink = computed(() => '/admin/reservations/materials');
  readonly receiptsLink = computed(() => (this.isDepotManager() ? '/depot/receipts' : '/admin/receipts'));
  readonly ordersLink = computed(() => '/admin/orders');
  readonly stockAlertsLink = computed(() => (this.isDepotManager() ? '/depot/alerts/stock' : '/admin/alerts/stock'));

  /* ---------------------------
   * Actions
   * --------------------------- */

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  goDashboard(): void {
    this.router.navigate([this.dashboardLink()]).then();
  }

  goProfile(): void {
    this.router.navigate(['/profile']);
  }

  goUserAccess(): void {
    this.router.navigate(['/admin/security/user-access']);
  }

  goHr(): void {
    this.router.navigate(['/admin/hr']);
  }

  goMovements(): void {
    this.router.navigate([this.movementsLink()]).then();
  }

  goInterventions(): void {
    this.router.navigate(['/admin/interventions']).then();
  }

  goReservations(): void {
    this.router.navigate([this.reservationsLink()]).then();
  }

  goMaterialReservations(): void {
    this.router.navigate([this.materialReservationsLink()]).then();
  }

  goReceipts(): void {
    this.router.navigate([this.receiptsLink()]).then();
  }

  goOrders(): void {
    this.router.navigate([this.ordersLink()]).then();
  }

  goStockAlerts(): void {
    this.router.navigate([this.stockAlertsLink()]).then();
  }

  goRevenue(): void {
    this.router.navigate(['/admin/revenue']).then();
  }

  logout(): void {
    this.auth.logout(true).subscribe();
  }

  private triggerDirigeantWelcome(): void {
    if (this.welcomeShown) return;
    this.welcomeShown = true;
    this.showDirigeantWelcome.set(true);
    if (this.welcomeTimer) clearTimeout(this.welcomeTimer);
    this.welcomeTimer = setTimeout(() => {
      this.showDirigeantWelcome.set(false);
    }, 5000);
  }

  /* ---------------------------
   * Title resolver (simple)
   * --------------------------- */
  private computeTitle(url: string): string {
    if (url.startsWith('/depot')) {
      if (url.includes('/resources/vehicles')) return 'Véhicules';
      if (url.includes('/resources/materials')) return 'Matériels';
      if (url.includes('/resources/consumables')) return 'Consommables';
      if (url.includes('/reservations')) return 'Réservations';
      if (url.includes('/receipts')) return 'Réceptions';
      if (url.includes('/alerts/stock')) return 'Alertes';
      if (url.includes('/history')) return 'Mouvements';
      return 'Dépôt';
    }
    if (url.includes('/depots')) return 'Dépôts';
    if (url.includes('/users')) return 'Utilisateurs';
    if (url.includes('/hr')) return 'Ressources humaines';
    if (url.includes('/security/user-access')) return 'Accès connexion';
    if (url.includes('/reservations/materials')) return 'Réservations matériels';
    if (url.includes('/reservations')) return 'Réservations';
    if (url.includes('/receipts')) return 'Réceptions';
    if (url.includes('/orders/new')) return 'Nouvelle commande';
    if (url.includes('/orders')) return 'Commandes';
    if (url.includes('/alerts/stock')) return 'Alertes';
    if (url.includes('/interventions')) return 'Interventions';
    if (url.includes('/revenue')) return "Chiffre d'affaires";
    if (url.includes('/consumables')) return 'Consommables';
    if (url.includes('/materials')) return 'Matériels';
    return 'Dashboard';
  }
}
