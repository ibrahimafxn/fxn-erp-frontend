import {Component, computed, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterModule} from '@angular/router';

import {AuthService} from '../../../core/services/auth.service';
import {Role} from '../../../core/models/roles.model';

@Component({
  standalone: true,
  selector: 'app-unauthorized',
  templateUrl: './unauthorized.html',
  styleUrls: ['./unauthorized.scss'],
  imports: [CommonModule, RouterModule]
})
export class Unauthorized {
  private auth = inject(AuthService);
  private router = inject(Router);

  // Rôle courant (signal)
  readonly role = computed(() => this.auth.getUserRole());

  // Destination par défaut selon rôle
  readonly homeUrl = computed(() => {
    const r = this.role();
    if (r === Role.ADMIN || r === Role.DIRIGEANT) return '/admin/dashboard';
    if (r === Role.GESTION_DEPOT) return '/depot';
    if (r === Role.TECHNICIEN) return '/technician';
    return '/login';
  });

  goHome(): void {
    this.router.navigateByUrl(this.homeUrl()).then();
  }

  logout(): void {
    this.auth.logout(true).subscribe();
  }
}
