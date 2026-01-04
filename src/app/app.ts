import {Component, effect, inject, signal} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {AppHeader} from './layout/app-header/app-header';
import {AuthService} from './core/services/auth.service';
import {Role} from './core/models/roles.model';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);

  protected readonly title = signal('fxn-erp-frontend');

  private readonly themeEffect = effect(() => {
    const role = this.auth.getUserRole();
    const body = this.document.body;
    const classes = ['theme-default', 'theme-admin', 'theme-dirigeant', 'theme-gestion-depot', 'theme-technicien'];

    classes.forEach(c => body.classList.remove(c));

    switch (role) {
      case Role.ADMIN:
        body.classList.add('theme-admin');
        break;
      case Role.DIRIGEANT:
        body.classList.add('theme-dirigeant');
        break;
      case Role.GESTION_DEPOT:
        body.classList.add('theme-gestion-depot');
        break;
      case Role.TECHNICIEN:
        body.classList.add('theme-technicien');
        break;
      default:
        body.classList.add('theme-default');
        break;
    }
  });
}
