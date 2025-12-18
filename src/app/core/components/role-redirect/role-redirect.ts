import {Component, inject} from '@angular/core';
import {Router} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {Role} from '../../models/roles.model';

@Component({
  standalone: true,
  template: ''
})
export class RoleRedirect {
  private auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    const role = this.auth.getUserRole();

    switch (role) {
      case Role.ADMIN:
      case Role.DIRIGEANT:
        this.router.navigate(['/admin/dashboard']);
        break;

      case Role.GESTION_DEPOT:
      case Role.TECHNICIEN:
        this.router.navigate(['/depot']);
        break;

      default:
        this.router.navigate(['/login']);
    }
  }
}
