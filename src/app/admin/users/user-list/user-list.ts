import {Component, computed, effect, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterModule} from '@angular/router';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';

import {UserService} from '../../../core/services/user.service';
import {User} from '../../../core/models';
import {Role} from '../../../core/models/roles.model';

@Component({
  standalone: true,
  selector: 'app-user-list',
  templateUrl: './user-list.html',
  styleUrls: ['./user-list.scss'],
  imports: [CommonModule, RouterModule, ReactiveFormsModule]
})
export class UserList {
  private usersService = inject(UserService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // -----------------------------
  // Signals exposés par le service
  // -----------------------------
  readonly users = this.usersService.users;     // Signal<User[]>
  readonly meta = this.usersService.meta;       // Signal<{total,page,limit} | null>
  readonly loading = this.usersService.loading; // Signal<boolean>
  readonly error = this.usersService.error;     // Signal<any>

  // -----------------------------
  // UI state (local au composant)
  // -----------------------------

  /**
   * Form de filtres (q = recherche texte, role = filtre par rôle)
   * -> on envoie ces valeurs au backend via refreshUsers()
   */
  readonly filtersForm = this.fb.group({
    q: [''],
    role: ['']
  });

  /**
   * Pagination : page courante et nombre d’éléments par page
   * (on les envoie au backend)
   */
  readonly page = signal(1);
  readonly limit = signal(25);

  /**
   * Pour gérer le bouton "Supprimer" (désactiver pendant la suppression)
   */
  readonly deletingId = signal<string | null>(null);

  /**
   * Liste des rôles (doit matcher ton enum backend)
   */
  readonly roles = [
    { value: '', label: 'Tous les rôles' },
    { value: Role.DIRIGEANT, label: 'Dirigeant' },
    { value: Role.ADMIN, label: 'Administrateur' },
    { value: Role.GESTION_DEPOT, label: 'Gestion dépôt' },
    { value: Role.TECHNICIEN, label: 'Technicien' }
  ];

  /**
   * Un petit computed pratique pour afficher "Page X / Y"
   */
  readonly totalPages = computed(() => {
    const m = this.meta();
    if (!m) return 1;
    const pages = Math.ceil((m.total || 0) / (m.limit || 1));
    return Math.max(1, pages);
  });

  constructor() {
    // Chargement initial
    this.load();

    /**
     * Auto-reload quand :
     * - q change
     * - role change
     * - page change
     * - limit change
     *
     * NOTE : on remet la page à 1 quand on change q/role/limit.
     */
    effect(() => {
      const q = (this.filtersForm.value.q || '').trim();
      const role = (this.filtersForm.value.role || '').trim();
      const page = this.page();
      const limit = this.limit();

      // Important : si l’utilisateur change q/role, et qu’il était en page 3,
      // ça peut renvoyer 0 résultat => on force page=1 au prochain "vrai" changement.
      // Ici on ne peut pas distinguer proprement sans écouteur dédié,
      // donc on gère via méthodes onSearch()/onRoleChange() plus bas.
      this.usersService.refreshUsers(false, { q: q || undefined, role: role || undefined, page, limit }).subscribe({
        error: () => {}
      });
    });
  }

  // -----------------------------
  // Actions
  // -----------------------------

  /**
   * Recharge en forçant le cache (force=true) : utile bouton "Recharger"
   */
  reload(): void {
    this.load(true);
  }

  /**
   * Charge (ou recharge) la liste depuis le backend.
   */
  private load(force = false): void {
    const q = (this.filtersForm.value.q || '').trim();
    const role = (this.filtersForm.value.role || '').trim();

    this.usersService.refreshUsers(force, {
      q: q || undefined,
      role: role || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({ error: () => {} });
  }

  /**
   * Quand on tape une recherche, on repart en page 1.
   */
  onSearch(): void {
    this.page.set(1);
    this.load(true);
  }

  /**
   * Quand on change le rôle, on repart en page 1.
   */
  onRoleChange(): void {
    this.page.set(1);
    this.load(true);
  }

  /**
   * Changement du nombre de lignes par page => page 1 + reload
   */
  onLimitChange(newLimit: number): void {
    this.limit.set(newLimit);
    this.page.set(1);
    this.load(true);
  }

  /**
   * Pagination : page précédente
   */
  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.load(true);
  }

  /**
   * Pagination : page suivante
   */
  nextPage(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.set(this.page() + 1);
    this.load(true);
  }

  /**
   * Aller vers la création
   */
  goCreate(): void {
    this.router.navigate(['/admin/users/new']).then();
  }

  /**
   * Aller vers l’édition (utilise _id mongo)
   */
  edit(u: User): void {
    this.router.navigate(['/admin/users', (u as any)._id]).then();
  }

  /**
   * Suppression avec confirmation
   */
  delete(u: User): void {
    const id = (u as any)._id as string;
    if (!id) return;

    const label = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || id;
    if (!confirm(`Supprimer l'utilisateur "${label}" ?`)) return;

    this.deletingId.set(id);
    this.usersService.deleteUser(id).subscribe({
      next: () => this.deletingId.set(null),
      error: () => this.deletingId.set(null)
    });
  }

  /**
   * trackBy pour @for (performance)
   */
// user-list.ts (dans la classe)
  trackById = (_: number, u: User) => this.userId(u);

  /** Renvoie l'id Mongo */
  userId(u: User): string {
    return (u as unknown as { _id: string })._id;
  }

  /** Renvoie createdAt si présent */
  userCreatedAt(u: User): string | null {
    return (u as unknown as { createdAt?: string }).createdAt ?? null;
  }
}
