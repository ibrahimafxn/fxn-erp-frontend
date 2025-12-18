import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models';

type LoadState = 'idle' | 'loading' | 'error' | 'ready';

@Component({
  standalone: true,
  selector: 'app-user-detail',
  templateUrl: './user-detail.html',
  styleUrls: ['./user-detail.scss'],
  imports: [CommonModule, RouterModule, DatePipe]
})
export class UserDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private users = inject(UserService);

  readonly state = signal<LoadState>('idle');
  readonly error = signal<string | null>(null);

  readonly userId = computed(() => this.route.snapshot.paramMap.get('id') || '');

  /** User chargé (signal local) */
  readonly user = signal<User | null>(null);

  /** UI helpers */
  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '—';
    const fn = (u.firstName || '').trim();
    const ln = (u.lastName || '').trim();
    return `${fn} ${ln}`.trim() || u.email || '—';
  });

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const a = (u.firstName || '').trim().charAt(0);
    const b = (u.lastName || '').trim().charAt(0);
    const s = `${a}${b}`.toUpperCase();
    return s || (u.email ? u.email.charAt(0).toUpperCase() : '?');
  });

  /** “Accès activé” si username présent (et/ou password existant côté back) */
  readonly hasAccess = computed(() => {
    const u = this.user();
    return !!(u && (u.username || (u as any).hasCredentials));
  });

  constructor() {
    this.load();
  }

  load(): void {
    const id = this.userId();
    if (!id) {
      this.router.navigate(['/admin/users']).then();
      return;
    }

    this.state.set('loading');
    this.error.set(null);

    this.users.getUser(id).subscribe({
      next: (u) => {
        // Si ton API renvoie {success,data}, adapte ici.
        this.user.set((u as any)?.data ?? u);
        this.state.set('ready');
      },
      error: (err) => {
        this.state.set('error');
        this.error.set(err?.error?.message || 'Impossible de charger la fiche utilisateur');
      }
    });
  }

  backToList(): void {
    this.router.navigate(['/admin/users']).then();
  }

  edit(): void {
    // si tu as /admin/users/:id/edit, adapte
    this.router.navigate(['/admin/users', this.userId(), 'edit']).then();
  }

  /** Exemple: aller vers une page give-access */
  goGiveAccess(): void {
    this.router.navigate(['/admin/users', this.userId(), 'access']).then();
  }

  /** Exemple: changer password */
  goChangePassword(): void {
    this.router.navigate(['/admin/users', this.userId(), 'password']).then();
  }

  delete(): void {
    const u = this.user();
    if (!u) return;

    const ok = confirm(`Supprimer ${this.displayName()} ? Cette action est irréversible.`);
    if (!ok) return;

    this.users.deleteUser((u as any)._id || (u as any).id || this.userId()).subscribe({
      next: () => this.router.navigate(['/admin/users']),
      error: (err) => this.error.set(err?.error?.message || 'Suppression impossible')
    });
  }
}
