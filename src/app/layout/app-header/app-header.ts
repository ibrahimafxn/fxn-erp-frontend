import { Component, computed, effect, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { AuthService, AuthUser } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';
import { formatPersonName } from '../../core/utils/text-format';
import { resolveCloudinaryAvatarUrl } from '../../core/utils/avatar-url';
import { AlertsService } from '../../core/services/alerts.service';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-header',
  imports: [CommonModule, RouterModule, MatButtonModule],
  templateUrl: './app-header.html',
  styleUrls: ['./app-header.scss'],
})
export class AppHeader {
  private auth = inject(AuthService);
  private router = inject(Router);
  private location = inject(Location);
  private alertsService = inject(AlertsService);

  // user
  readonly user = this.auth.user$;

  // menu state
  readonly menuOpen = signal(false);
  readonly currentLocale = signal<'fr' | 'en'>('fr');

  // breadcrumb label simple (V2)
  readonly pageTitle = signal('Dashboard');
  readonly currentUrl = signal(this.router.url);
  readonly alertsCount = this.alertsService.count;
  readonly showDirigeantWelcome = signal(false);
  private welcomeShown = false;
  private welcomeTimer: ReturnType<typeof setTimeout> | null = null;
  readonly showBackButton = computed(() => {
    const url = this.currentUrl();
    if (this.isDashboardUrl(url)) return false;
    if (this.isOrdersNewUrl(url)) return true;
    return !this.hasLocalBack(url);
  });

  constructor() {
    this.currentLocale.set(this.detectLocale());
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.pageTitle.set(this.computeTitle(this.router.url));
        this.menuOpen.set(false);
        this.currentLocale.set(this.detectLocale());
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
    return resolveCloudinaryAvatarUrl(u?.photoUrl, u?.avatarUrl);
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
  readonly isTechnician = computed(() => this.user()?.role === 'TECHNICIEN');

  readonly canManageAccess = computed(() => {
    const role = this.user()?.role;
    return role === 'DIRIGEANT' || role === 'ADMIN';
  });

  readonly canViewHr = computed(() => this.canManageAccess());
  readonly canViewMovements = computed(() => this.canManageAccess() || this.isDepotManager());
  readonly canViewInterventions = computed(() => this.canManageAccess());
  readonly canViewTechnicianActivity = computed(() => this.canManageAccess());
  readonly canViewMaterialReservations = computed(() => this.canManageAccess());
  readonly dashboardLink = computed(() => {
    if (this.isDepotManager()) return '/depot';
    if (this.isTechnician()) return '/technician';
    return '/admin/dashboard';
  });
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

  back(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    this.router.navigateByUrl(this.dashboardLink()).then();
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

  goInterventionsImport(): void {
    this.router.navigate(['/admin/interventions/import']).then();
  }
  goTechnicianActivity(): void {
    this.router.navigate(['/admin/technicians/activity']).then();
  }

  goTechnicianInterventions(): void {
    this.router.navigate(['/admin/technicians/interventions']).then();
  }

  goAgenda(): void {
    this.router.navigate(['/admin/agenda']).then();
  }

  goBpu(): void {
    this.router.navigate(['/admin/bpu']).then();
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

  goTechMaterials(): void {
    this.router.navigate(['/technician/resources/materials']).then();
  }

  goTechConsumables(): void {
    this.router.navigate(['/technician/resources/consumables']).then();
  }

  goTechVehicles(): void {
    this.router.navigate(['/technician/resources/vehicles']).then();
  }

  goTechReports(): void {
    this.router.navigate(['/technician/reports']).then();
  }

  goTechRevenue(): void {
    this.router.navigate(['/technician/revenue']).then();
  }

  goTechHistory(): void {
    this.router.navigate(['/technician/history']).then();
  }

  logout(): void {
    this.auth.logout(true).subscribe();
  }

  localeHref(locale: 'fr' | 'en'): string {
    const path = window.location.pathname || '/';
    const normalized = path.startsWith('/en/')
      ? path.slice(3)
      : path === '/en'
        ? '/'
        : path;
    const base = locale === 'en' ? `/en${normalized === '/' ? '' : normalized}` : (normalized || '/');
    return `${base}${window.location.search || ''}${window.location.hash || ''}`;
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
  private hasLocalBack(url: string): boolean {
    if (!url) return false;
    if (url.includes('/detail')) return true;
    if (url.includes('/edit')) return true;
    if (url.includes('/new')) return true;
    if (url.includes('/breakdown')) return true;
    if (url.includes('/interventions/technician')) return true;
    if (/^\/admin\/resources\/materials\/[^/]+$/.test(url)) return true;
    if (/^\/admin\/resources\/consumables\/[^/]+$/.test(url)) return true;
    return false;
  }

  private isDashboardUrl(url: string): boolean {
    if (!url) return false;
    if (url === '/' || url === '/admin' || url === '/admin/dashboard') return true;
    if (url === '/depot' || url === '/technician') return true;
    return false;
  }

  private isOrdersNewUrl(url: string): boolean {
    return url === '/admin/orders/new';
  }

  private computeTitle(url: string): string {
    if (url.startsWith('/depot')) {
      if (url.includes('/resources/vehicles')) return 'Véhicules';
      if (url.includes('/resources/materials')) return 'Matériels';
      if (url.includes('/resources/consumables')) return 'Consommables';
      if (url.includes('/reservations')) return 'Attributions';
      if (url.includes('/receipts')) return 'Réceptions';
      if (url.includes('/alerts/stock')) return 'Alertes';
      if (url.includes('/history')) return 'Mouvements';
      return 'Dépôt';
    }
    if (url.startsWith('/technician')) {
      if (url.includes('/resources/vehicles')) return 'Véhicules';
      if (url.includes('/resources/materials')) return 'Matériels';
      if (url.includes('/resources/consumables')) return 'Consommables';
      if (url.includes('/reports')) return 'Rapport quotidien';
      if (url.includes('/revenue')) return "Chiffre d'affaires";
      if (url.includes('/history')) return 'Historique';
      return 'Technicien';
    }
    if (url.includes('/unauthorized')) return 'Accès refusé';
    if (url.includes('/depots')) return 'Dépôts';
    if (url.includes('/users')) return 'Utilisateurs';
    if (url.includes('/hr')) return 'Ressources humaines';
    if (url.includes('/security/user-access')) return 'Accès connexion';
    if (url.includes('/reservations/materials')) return 'Attributions matériels';
    if (url.includes('/reservations')) return 'Attributions';
    if (url.includes('/receipts')) return 'Réceptions';
    if (url.includes('/orders/new')) return 'Nouvelle commande';
    if (url.includes('/orders')) return 'Commandes';
    if (url.includes('/alerts/stock')) return 'Alertes';
    if (url.includes('/interventions/import')) return 'Import interventions';
    if (url.includes('/interventions')) return 'Interventions';
    if (url.includes('/technicians/interventions')) return 'Interventions techniciens';
    if (url.includes('/technicians/activity')) return 'Prestations techniciens';
    if (url.includes('/bpu')) return 'BPU prestations';
    if (url.includes('/revenue')) return "Chiffre d'affaires";
    if (url.includes('/consumables')) return 'Consommables';
    if (url.includes('/materials')) return 'Matériels';
    return 'Dashboard';
  }

  private detectLocale(): 'fr' | 'en' {
    const path = window.location.pathname || '';
    return path === '/en' || path.startsWith('/en/') ? 'en' : 'fr';
  }
}
