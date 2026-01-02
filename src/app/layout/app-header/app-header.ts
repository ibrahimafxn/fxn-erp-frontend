import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, AuthUser } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';
import { formatPersonName } from '../../core/utils/text-format';
import { AlertsService } from '../../core/services/alerts.service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, RouterModule],
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

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.pageTitle.set(this.computeTitle(this.router.url));
        this.menuOpen.set(false);
        this.alertsService.refresh();
      });
    this.alertsService.refresh();
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
  readonly dashboardLink = computed(() => (this.isDepotManager() ? '/depot' : '/admin/dashboard'));
  readonly movementsLink = computed(() => (this.isDepotManager() ? '/depot/history' : '/admin/history'));
  readonly reservationsLink = computed(() => (this.isDepotManager() ? '/depot/reservations' : '/admin/reservations'));
  readonly receiptsLink = computed(() => (this.isDepotManager() ? '/depot/receipts' : '/admin/receipts'));
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

  goReservations(): void {
    this.router.navigate([this.reservationsLink()]).then();
  }

  goReceipts(): void {
    this.router.navigate([this.receiptsLink()]).then();
  }

  goStockAlerts(): void {
    this.router.navigate([this.stockAlertsLink()]).then();
  }

  logout(): void {
    this.auth.logout(true).subscribe();
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
    if (url.includes('/reservations')) return 'Réservations';
    if (url.includes('/receipts')) return 'Réceptions';
    if (url.includes('/alerts/stock')) return 'Alertes';
    if (url.includes('/consumables')) return 'Consommables';
    if (url.includes('/materials')) return 'Matériels';
    return 'Dashboard';
  }
}
