import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models';

@Component({
  standalone: true,
  selector: 'app-user-detail',
  templateUrl: './user-detail.html',
  styleUrls: ['./user-detail.scss'],
  imports: [CommonModule],
  providers: [DatePipe]
})
export class UserDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private userService = inject(UserService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);

  readonly user = signal<User | null>(null);

  /** Champs "optionnels" qui existent dans Mongo mais pas forcément dans ton interface User */
  readonly createdAtText = computed(() => {
    const u = this.user() as any;
    const dt = u?.createdAt;
    return dt ? (this.datePipe.transform(dt, 'short') ?? '—') : '—';
  });

  readonly updatedAtText = computed(() => {
    const u = this.user() as any;
    const dt = u?.updatedAt;
    return dt ? (this.datePipe.transform(dt, 'short') ?? '—') : '—';
  });

  readonly usernameText = computed(() => {
    const u = this.user() as any;
    return u?.username ? String(u.username) : '—';
  });

  readonly idDepotText = computed(() => {
    const u = this.user() as any;
    return u?.idDepot ? String(u.idDepot) : 'Non affecté';
  });

  readonly vehicleText = computed(() => {
    const u = this.user() as any;
    return u?.assignedVehicle ? String(u.assignedVehicle) : 'Aucun';
  });

  constructor() {
    this.load();
  }

  private getId(): string {
    return this.route.snapshot.paramMap.get('id') || '';
  }

  load(): void {
    const id = this.getId();
    if (!id) {
      this.error.set('ID utilisateur manquant dans l’URL');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.userService.getUser(id).subscribe({
      next: (resp) => {
        const u = (resp as any)?.data ?? resp; // support {success,data} ou objet direct
        this.user.set(u as User);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Impossible de charger la fiche utilisateur');
        this.loading.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  edit(u: User): void {
    const id = ((u as any)?._id || (u as any)?.id || this.getId()) as string;
    this.router.navigate(['/admin/users', id, 'edit']);
  }

  delete(u: User): void {
    const id = ((u as any)?._id || (u as any)?.id || this.getId()) as string;
    const label = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || id;

    if (!confirm(`Supprimer "${label}" ? Cette action est irréversible.`)) return;

    this.deleting.set(true);
    this.error.set(null);

    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(['/admin/users']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err?.error?.message || 'Suppression impossible');
      }
    });
  }
}
