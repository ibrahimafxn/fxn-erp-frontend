import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, AuthUser } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';

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

  // user
  readonly user = this.auth.user$;

  // menu state
  readonly menuOpen = signal(false);

  // breadcrumb label simple (V2)
  readonly pageTitle = signal('Dashboard');

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.pageTitle.set(this.computeTitle(this.router.url));
        this.menuOpen.set(false);
      });
  }

  /* ---------------------------
   * Computed user helpers
   * --------------------------- */

  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    return `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}`;
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

  /* ---------------------------
   * Actions
   * --------------------------- */

  toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  goDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  goProfile(): void {
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.auth.logout(true).subscribe();
  }

  /* ---------------------------
   * Title resolver (simple)
   * --------------------------- */
  private computeTitle(url: string): string {
    if (url.includes('/depots')) return 'Dépôts';
    if (url.includes('/users')) return 'Utilisateurs';
    if (url.includes('/consumables')) return 'Consommables';
    if (url.includes('/materials')) return 'Matériels';
    return 'Dashboard';
  }
}
