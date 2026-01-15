import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DepotService } from '../../../core/services/depot.service';
import { Role } from '../../../core/models/roles.model';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private auth = inject(AuthService);
  private router = inject(Router);
  private depotService = inject(DepotService);

  readonly user = this.auth.user$;
  readonly depotName = signal('—');
  readonly depotLoading = signal(false);
  private lastDepotId: string | null = null;

  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '—';
    return formatPersonName(u.firstName ?? '', u.lastName ?? '') || u.email;
  });

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  });

  readonly roleLabel = computed(() => {
    switch (this.user()?.role) {
      case Role.DIRIGEANT: return 'Dirigeant';
      case Role.ADMIN: return 'Administrateur';
      case Role.GESTION_DEPOT: return 'Gestion dépôt';
      case Role.TECHNICIEN: return 'Technicien';
      default: return '—';
    }
  });

  readonly accessItems = computed(() => {
    const role = this.user()?.role;
    if (role === Role.ADMIN || role === Role.DIRIGEANT) {
      return [
        { icon: 'key', label: 'Accès utilisateurs', desc: 'Gestion des comptes et droits' },
        { icon: 'swap_horiz', label: 'Mouvements', desc: 'Historique des flux et réservations' },
        { icon: 'report', label: 'Alertes', desc: 'Suivi des stocks et anomalies' }
      ];
    }
    if (role === Role.GESTION_DEPOT) {
      return [
        { icon: 'inventory_2', label: 'Stock dépôt', desc: 'Suivi quotidien du stock' },
        { icon: 'widgets', label: 'Réservations', desc: 'Attribution des consommables' },
        { icon: 'handyman', label: 'Matériels', desc: 'Gestion des outils et EPI' }
      ];
    }
    if (role === Role.TECHNICIEN) {
      return [
        { icon: 'assignment', label: 'Réservations', desc: 'Consommables attribués' },
        { icon: 'car_repair', label: 'Véhicule', desc: 'Suivi de l’affectation' },
        { icon: 'support_agent', label: 'Support', desc: 'Contact administrateur' }
      ];
    }
    return [];
  });

  private readonly depotSync = effect(() => {
    const idDepot = this.user()?.idDepot ?? null;
    if (!idDepot || typeof idDepot !== 'string') {
      this.lastDepotId = null;
      this.depotName.set('—');
      return;
    }
    if (idDepot === this.lastDepotId) return;
    this.lastDepotId = idDepot;
    this.depotLoading.set(true);
    this.depotService.getDepot(idDepot).subscribe({
      next: (depot) => {
        const name = formatDepotName(depot?.name || '') || depot?.name || idDepot;
        this.depotName.set(name);
        this.depotLoading.set(false);
      },
      error: () => {
        this.depotName.set(idDepot);
        this.depotLoading.set(false);
      }
    });
  });

  goHome(): void {
    const role = this.auth.getUserRole();
    if (role === Role.ADMIN || role === Role.DIRIGEANT) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    if (role === Role.GESTION_DEPOT) {
      this.router.navigate(['/depot']);
      return;
    }
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout(true).subscribe();
  }
}
