import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { Role } from '../../../core/models/roles.model';
import { UserListResult } from '../../../core/models/user-list-result.model';

/** Réponse standard du backend */
type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: any };

/**
 * ViewModel pour le template :
 * - évite les "as any" dans le HTML
 * - fournit des champs "prêts à afficher"
 */
type UserRowVM = User & {
  id: string;
  fullName: string;
  createdAtText: string;
};

@Component({
  standalone: true,
  selector: 'app-user-list',
  templateUrl: './user-list.html',
  styleUrls: ['./user-list.scss'],
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  providers: [DatePipe]
})
export class UserList {
  private userService = inject(UserService);
  private router = inject(Router);
  private datePipe = inject(DatePipe);

  // -----------------------------
  // UI state
  // -----------------------------
  /** ID en cours de suppression (pour désactiver le bouton + afficher "Suppression…") */
  readonly deletingId = signal<string | null>(null);

  // -----------------------------
  // Filters (Reactive Forms)
  // -----------------------------
  /** Recherche libre (backend: query param "q") */
  readonly q = new FormControl<string>('', { nonNullable: true });

  /** Filtre rôle */
  readonly role = new FormControl<Role | 'ALL'>('ALL', { nonNullable: true });

  /** Options pour select rôle */
  readonly roleOptions: Array<{ label: string; value: Role | 'ALL' }> = [
    { label: 'Tous', value: 'ALL' },
    { label: 'Dirigeant', value: Role.DIRIGEANT },
    { label: 'Admin', value: Role.ADMIN },
    { label: 'Gestion dépôt', value: Role.GESTION_DEPOT },
    { label: 'Technicien', value: Role.TECHNICIEN }
  ];

  // -----------------------------
  // Pagination (basée sur l’API)
  // -----------------------------
  readonly page = signal<number>(1);
  readonly limit = signal<number>(25);

  /** Résultat complet (total/page/limit/items) */
  readonly result = signal<UserListResult | null>(null);

  /** Total pages (arrondi au dessus) */
  readonly totalPages = computed(() => {
    const r = this.result();
    if (!r) return 1;
    const pages = Math.ceil((r.total || 0) / (r.limit || 25));
    return Math.max(1, pages);
  });

  // -----------------------------
  // State du service
  // -----------------------------
  readonly loading = this.userService.loading;

  /** Erreur affichable proprement */
  readonly errorText = computed(() => {
    const e = this.userService.error();
    return e?.error?.message || e?.message || (typeof e === 'string' ? e : null);
  });

  // -----------------------------
  // ViewModel (pour le template)
  // -----------------------------
  readonly rows = computed<UserRowVM[]>(() => {
    const r = this.result();
    const list = r?.items || [];

    return list.map((u) => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;

      const createdAtText = u.createdAt
        ? (this.datePipe.transform(u.createdAt, 'short') ?? '—')
        : '—';

      return {
        ...u,
        id: u._id,
        fullName,
        createdAtText
      };
    });
  });

  // -----------------------------
  // Init
  // -----------------------------
  constructor() {
    // Chargement initial
    this.load(true);

    // Recherche: debounce pour éviter de spam l’API à chaque frappe
    this.q.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(1);
        this.load(true);
      });

    // Filtre rôle: recharge immédiate
    this.role.valueChanges.subscribe(() => {
      this.page.set(1);
      this.load(true);
    });
  }

  // -----------------------------
  // API load
  // -----------------------------
  load(force = false): void {
    const roleVal = this.role.value === 'ALL' ? undefined : this.role.value;

    this.userService
      .refreshUsers(force, {
        q: this.q.value?.trim() || undefined,
        role: roleVal,
        page: this.page(),
        limit: this.limit()
      })
      .subscribe({
        next: (res) => {
          // refreshUsers retourne UserListResult (déjà map(resp.data) côté service)
          this.result.set(res);
        },
        error: () => {
          // l'erreur est déjà stockée dans userService.error()
          this.result.set(null);
        }
      });
  }

  // -----------------------------
  // Navigation / Actions
  // -----------------------------
  create(): void {
    this.router.navigate(['/admin/users/new']);
  }

  open(u: UserRowVM): void {
    this.router.navigate(['/admin/users', u.id]);
  }

  edit(u: UserRowVM): void {
    this.router.navigate(['/admin/users', u.id, 'edit']);
  }

  delete(u: UserRowVM): void {
    const label = u.fullName || u.email || u.id;
    if (!confirm(`Supprimer "${label}" ?`)) return;

    this.deletingId.set(u.id);

    this.userService.deleteUser(u.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.load(true);
      },
      error: () => {
        this.deletingId.set(null);
      }
    });
  }

  // -----------------------------
  // Pagination actions
  // -----------------------------
  prev(): void {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.load(true);
  }

  next(): void {
    if (this.page() >= this.totalPages()) return;
    this.page.set(this.page() + 1);
    this.load(true);
  }

  back(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  // -----------------------------
  // TrackBy
  // -----------------------------
  trackById = (_: number, u: UserRowVM) => u.id;
}
