import { Component, AfterViewInit, OnDestroy, effect, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {AppHeader} from './layout/app-header/app-header';
import {AuthService} from './core/services/auth.service';
import { UserPreferencesService } from './core/services/user-preferences.service';
import { ThemeOverride, UserPreferences } from './core/models';
import {Role} from './core/models/roles.model';
import { environment } from './environments/environment';
import packageJson from '../../package.json';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AppHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly preferencesApi = inject(UserPreferencesService);
  private readonly document = inject(DOCUMENT);
  private toneObserver: MutationObserver | null = null;
  private lastPrefsUserId: string | null = null;
  private routeSub: Subscription | null = null;

  protected readonly title = signal('fxn-erp-frontend');
  private readonly routeUrl = signal(this.router.url);
  readonly showHeader = computed(() =>
    this.auth.ready$() &&
    this.auth.isAuthenticated() &&
    this.usesAuthenticatedShell(this.routeUrl())
  );
  readonly showFooter = computed(() => !this.isFullscreenAuthRoute(this.routeUrl()));
  readonly showHeidiOverlay = computed(() => {
    const user = this.auth.user$();
    if (!user || user.role !== Role.ADMIN) return false;
    return this.isAdminDashboardRoute(this.routeUrl());
  });
  readonly isTechnician = computed(() => this.auth.user$()?.role === Role.TECHNICIEN);
  readonly currentYear = new Date().getFullYear();
  readonly appVersion = packageJson.version ?? '—';
  constructor() {
    this.auth.bootstrapSession();
    this.routeSub = this.router.events
      .pipe(filter((evt) => evt instanceof NavigationEnd))
      .subscribe((evt) => {
        const nav = evt as NavigationEnd;
        this.routeUrl.set(nav.urlAfterRedirects || nav.url);
      });
  }
  private readonly preferencesEffect = effect(() => {
    const user = this.auth.user$();
    const userId = user?._id ?? null;
    if (!userId || this.lastPrefsUserId === userId) return;
    this.lastPrefsUserId = userId;
    this.preferencesApi.getMyPreferences().subscribe({
      next: (prefs) => this.auth.updateCurrentUser({ preferences: prefs }),
      error: () => {}
    });
  });

  private readonly themeEffect = effect(() => {
    const user = this.auth.user$();
    const prefs = this.normalizePreferences(user?.preferences);
    const override = this.normalizeTheme(prefs?.themeOverride ?? null);
    const role = user?.role ?? null;
    const body = this.document.body;
    const classes = ['theme-default', 'theme-admin', 'theme-dirigeant', 'theme-gestion-depot', 'theme-technicien'];

    classes.forEach(c => body.classList.remove(c));

    const themeClass = this.resolveThemeClass(override, role);
    body.classList.add(themeClass);
  });

  private readonly densityEffect = effect(() => {
    const body = this.document.body;
    const prefs = this.normalizePreferences(this.auth.user$()?.preferences);
    body.classList.toggle('ui-compact', prefs?.density === 'compact');
  });

  private readonly motionEffect = effect(() => {
    const body = this.document.body;
    const prefs = this.normalizePreferences(this.auth.user$()?.preferences);
    body.classList.toggle('ui-reduced-motion', prefs?.motion === 'reduced');
  });

  ngAfterViewInit(): void {
    this.applyButtonTones();
    this.toneObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === 'BUTTON') {
            this.applyTone(node as HTMLButtonElement);
            return;
          }
          const buttons = node.querySelectorAll?.('button') ?? [];
          buttons.forEach((btn) => this.applyTone(btn as HTMLButtonElement));
        });
      }
    });
    this.toneObserver.observe(this.document.body, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.toneObserver?.disconnect();
    this.toneObserver = null;
    this.routeSub?.unsubscribe();
    this.routeSub = null;
  }

  private normalizeTheme(value: string | ThemeOverride | null): ThemeOverride {
    if (value === 'default' || value === 'admin' || value === 'dirigeant' || value === 'gestion-depot' || value === 'technicien') {
      return value;
    }
    return null;
  }

  private normalizePreferences(prefs?: UserPreferences | null): UserPreferences {
    return {
      themeOverride: this.normalizeTheme(prefs?.themeOverride ?? null),
      density: prefs?.density === 'compact' ? 'compact' : 'comfortable',
      motion: prefs?.motion === 'reduced' ? 'reduced' : 'full',
      avatar: prefs?.avatar ?? null
    };
  }

  private resolveThemeClass(override: ThemeOverride, role: Role | null): string {
    if (override) return `theme-${override}`;
    switch (role) {
      case Role.ADMIN:
        return 'theme-admin';
      case Role.DIRIGEANT:
        return 'theme-dirigeant';
      case Role.GESTION_DEPOT:
        return 'theme-gestion-depot';
      case Role.TECHNICIEN:
        return 'theme-technicien';
      default:
        return 'theme-default';
    }
  }

  private isFullscreenAuthRoute(url: string): boolean {
    const clean = (url || '').split('?')[0].split('#')[0].toLowerCase();
    return clean === '/login';
  }

  private usesAuthenticatedShell(url: string): boolean {
    const clean = (url || '').split('?')[0].split('#')[0].toLowerCase();
    return (
      clean.startsWith('/admin') ||
      clean.startsWith('/depot') ||
      clean.startsWith('/technician') ||
      clean.startsWith('/profile') ||
      clean.startsWith('/preferences') ||
      clean.startsWith('/unauthorized')
    );
  }

  private isAdminDashboardRoute(url: string): boolean {
    const clean = (url || '').split('?')[0].split('#')[0].toLowerCase();
    return clean === '/admin' || clean === '/admin/dashboard';
  }

  private applyButtonTones(): void {
    this.document.querySelectorAll('button').forEach((btn) => this.applyTone(btn as HTMLButtonElement));
  }

  private applyTone(button: HTMLButtonElement): void {
    const hasBtnClass = Array.from(button.classList).some((c) => c.startsWith('btn-'));
    if (!hasBtnClass) return;

    const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    const lower = text
      .toLowerCase()
      .replace(/[←→]/g, '')
      .replace(/\u2026/g, '')
      .trim();

    const tones = [
      'btn-tone-danger',
      'btn-tone-success',
      'btn-tone-primary',
      'btn-tone-info',
      'btn-tone-neutral',
      'btn-tone-export-pdf',
      'btn-tone-export-csv',
      'btn-tone-flat',
      'btn-tone-new',
      'btn-tone-outline-primary',
      'btn-tone-outline-danger',
      'btn-tone-outline-success',
      'btn-tone-outline-neutral'
    ];
    tones.forEach((tone) => button.classList.remove(tone));

    if (lower.includes('exporter pdf')) {
      button.classList.add('btn-tone-export-pdf');
      return;
    }
    if (lower.includes('exporter csv') || lower.includes('exporter excel')) {
      button.classList.add('btn-tone-export-csv');
      return;
    }
    if (lower.includes('importer') || lower.includes('exporter')) return;

    const isMatch = (keywords: string[]) => keywords.some((k) => lower.includes(k));

    if (isMatch(['supprimer'])) {
      return;
    }
    if (isMatch(['désactiver', 'rejeter', 'retirer', 'reset'])) {
      button.classList.add('btn-tone-danger');
      return;
    }
    if (isMatch(['enregistrer', 'valider', 'confirmer', 'créer', 'approuver', 'activer'])) {
      button.classList.add('btn-tone-success');
      return;
    }
    if (isMatch(['nouveau'])) {
      button.classList.add('btn-tone-new');
      return;
    }
    if (isMatch(['reprendre'])) {
      button.classList.add('btn-tone-outline-neutral');
      return;
    }
    if (isMatch(['effacer'])) {
      button.classList.add('btn-tone-outline-danger');
      return;
    }
    if (isMatch(['réserver'])) {
      button.classList.add('btn-tone-outline-success');
      return;
    }
    if (isMatch(['ajouter', 'assigner', 'attribuer', 'déclarer', 'marquer', 'connecter'])) {
      button.classList.add('btn-tone-primary');
      return;
    }
    if (isMatch(['rechercher'])) {
      button.classList.add('btn-tone-outline-primary');
      return;
    }
    if (isMatch(['rafraîchir'])) {
      button.classList.add('btn-tone-primary');
      return;
    }
    if (isMatch(['voir', 'recharger', 'actualiser', 'télécharger', 'afficher', 'masquer', 'réessayer'])) {
      button.classList.add('btn-tone-info');
      return;
    }
    if (isMatch(['annuler', 'fermer', 'retour', 'précédent', 'suivant', 'effacer', 'réinitialiser', 'déconnexion', 'revenir'])) {
      button.classList.add('btn-tone-neutral');
      return;
    }
  }
}
