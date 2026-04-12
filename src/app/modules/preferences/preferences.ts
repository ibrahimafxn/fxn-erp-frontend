import { ChangeDetectionStrategy, Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import {
  AvatarChoice,
  AutoLogoutChoice,
  DateFormatChoice,
  DecimalSeparatorChoice,
  FontSizeChoice,
  TablePageSizeChoice,
  ThemeOverride,
  THEMES_META,
  UserPreferences
} from '../../core/models';
import { Role } from '../../core/models/roles.model';

type ThemeChoice = 'auto' | Exclude<ThemeOverride, null>;
type DensityChoice = 'comfortable' | 'compact';
type MotionChoice = 'full' | 'reduced';
type AvatarOption = { value: AvatarChoice; label: string; src: string };
type DefaultPageOption = { value: string; label: string };

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-preferences',
  imports: [CommonModule, FormsModule],
  templateUrl: './preferences.html',
  styleUrls: ['./preferences.scss']
})
export class Preferences implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly preferencesApi = inject(UserPreferencesService);

  // ── Existants ──────────────────────────────────────────────────────────────
  readonly theme   = signal<ThemeChoice>('auto');
  readonly density = signal<DensityChoice>('comfortable');
  readonly motion  = signal<MotionChoice>('full');
  readonly avatar  = signal<AvatarChoice>(null);

  // ── Affichage ──────────────────────────────────────────────────────────────
  readonly fontSize         = signal<FontSizeChoice>('normal');
  readonly dateFormat       = signal<DateFormatChoice>('dmy');
  readonly decimalSeparator = signal<DecimalSeparatorChoice>('comma');

  // ── Navigation ─────────────────────────────────────────────────────────────
  readonly defaultPage    = signal<string | null>(null);
  readonly tablePageSize  = signal<TablePageSizeChoice>(20);

  // ── Notifications ──────────────────────────────────────────────────────────
  readonly pushNotifications   = signal<boolean>(false);
  readonly soundAlerts         = signal<boolean>(false);
  readonly stockAlertThreshold = signal<number | null>(null);
  readonly pushPermission      = signal<NotificationPermission>('default');

  // ── Accessibilité ──────────────────────────────────────────────────────────
  readonly highContrast      = signal<boolean>(false);
  readonly keyboardShortcuts = signal<boolean>(true);

  // ── Sécurité ───────────────────────────────────────────────────────────────
  readonly autoLogout    = signal<AutoLogoutChoice>('never');
  readonly confirmDelete = signal<boolean>(true);

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly isAdmin = computed(() => {
    const role = this.auth.user$()?.role;
    return role === Role.ADMIN || role === Role.DIRIGEANT;
  });
  readonly isDepotManager = computed(() => this.auth.user$()?.role === Role.GESTION_DEPOT);

  // ── Options : thèmes ───────────────────────────────────────────────────────
  private readonly allThemeOptions = [
    { value: 'auto' as const, label: 'Automatique (par rôle)', desc: 'Adapte les couleurs au profil connecté.', universal: true },
    ...THEMES_META.map(t => ({ ...t, value: t.value as ThemeChoice }))
  ];

  readonly themeOptions = computed(() => {
    const role = this.auth.user$()?.role;
    if (role === Role.ADMIN || role === Role.DIRIGEANT) return this.allThemeOptions;
    const allowedByRole: Record<string, ThemeChoice> = {
      [Role.GESTION_DEPOT]: 'gestion-depot',
      [Role.TECHNICIEN]: 'technicien'
    };
    const ownTheme = role ? allowedByRole[role] : undefined;
    return this.allThemeOptions.filter(option =>
      option.value === 'auto' || option.universal || option.value === ownTheme
    );
  });

  // ── Options : affichage ───────────────────────────────────────────────────
  readonly fontSizeOptions = [
    { value: 'small'  as const, label: 'Petite',  desc: 'Texte réduit, plus d\'espace.' },
    { value: 'normal' as const, label: 'Normale', desc: 'Taille par défaut.' },
    { value: 'large'  as const, label: 'Grande',  desc: 'Texte agrandi, meilleure lisibilité.' }
  ];

  readonly dateFormatOptions = [
    { value: 'dmy'      as const, label: 'JJ/MM/AAAA', desc: 'Format français standard.' },
    { value: 'mdy'      as const, label: 'MM/DD/YYYY', desc: 'Format américain.' },
    { value: 'relative' as const, label: 'Relatif',    desc: '« il y a 2 jours », « dans 3 h ».' }
  ];

  readonly decimalOptions = [
    { value: 'comma' as const, label: '1 234,50 €', desc: 'Virgule (format FR).' },
    { value: 'dot'   as const, label: '1,234.50 €', desc: 'Point (format EN).' }
  ];

  // ── Options : densité / animations ────────────────────────────────────────
  readonly densityOptions = [
    { value: 'comfortable' as const, label: 'Confortable', desc: 'Espacements standards pour la lecture.' },
    { value: 'compact'     as const, label: 'Compacte',    desc: 'Plus d\'informations à l\'écran.' }
  ];

  readonly motionOptions = [
    { value: 'full'    as const, label: 'Animations complètes', desc: 'Transitions et effets visuels actifs.' },
    { value: 'reduced' as const, label: 'Animations réduites',  desc: 'Moins d\'effets pour un confort accru.' }
  ];

  // ── Options : navigation ──────────────────────────────────────────────────
  readonly pageSizeOptions: { value: TablePageSizeChoice; label: string }[] = [
    { value: 10,  label: '10 lignes' },
    { value: 20,  label: '20 lignes' },
    { value: 50,  label: '50 lignes' },
    { value: 100, label: '100 lignes' }
  ];

  readonly defaultPageOptions = computed((): DefaultPageOption[] => {
    const role = this.auth.user$()?.role;
    const common = [{ value: '', label: 'Par défaut (selon rôle)' }];
    switch (role) {
      case Role.ADMIN:
      case Role.DIRIGEANT:
        return [...common,
          { value: '/admin/dashboard',      label: 'Dashboard admin' },
          { value: '/admin/agenda',          label: 'Agenda' },
          { value: '/admin/orders',          label: 'Commandes' },
          { value: '/admin/interventions',   label: 'Interventions' },
          { value: '/admin/revenue',         label: 'Revenus' }
        ];
      case Role.GESTION_DEPOT:
        return [...common,
          { value: '/depot/dashboard',           label: 'Dashboard dépôt' },
          { value: '/depot/attributions',        label: 'Attributions' },
          { value: '/depot/supply-requests',     label: 'Demandes de stock' }
        ];
      case Role.TECHNICIEN:
        return [...common,
          { value: '/technician/dashboard',              label: 'Tableau de bord' },
          { value: '/technician/agenda',                 label: 'Agenda' },
          { value: '/technician/interventions-history',  label: 'Historique interventions' }
        ];
      default:
        return common;
    }
  });

  // ── Options : sécurité ───────────────────────────────────────────────────
  readonly autoLogoutOptions: { value: AutoLogoutChoice; label: string; desc: string }[] = [
    { value: 'never', label: 'Jamais',  desc: 'Pas de déconnexion automatique.' },
    { value: '15',    label: '15 min',  desc: 'Après 15 min d\'inactivité.' },
    { value: '30',    label: '30 min',  desc: 'Après 30 min d\'inactivité.' },
    { value: '60',    label: '1 heure', desc: 'Après 1h d\'inactivité.' }
  ];

  // ── Avatars ───────────────────────────────────────────────────────────────
  readonly avatarOptions: AvatarOption[] = [
    { value: '10491830', label: 'Avatar 1', src: 'assets/avatars/10491830.jpg' },
    { value: '35480b05', label: 'Avatar 2', src: 'assets/avatars/35480b05.jpg' },
    { value: '9306614',  label: 'Avatar 3', src: 'assets/avatars/9306614.jpg'  },
    { value: '9334178',  label: 'Avatar 4', src: 'assets/avatars/9334178.jpg'  },
    { value: '9434619',  label: 'Avatar 5', src: 'assets/avatars/9434619.jpg'  },
    { value: '9720027',  label: 'Avatar 6', src: 'assets/avatars/9720027.jpg'  },
    { value: '9720029',  label: 'Avatar 7', src: 'assets/avatars/9720029.jpg'  },
    { value: '9963629',  label: 'Avatar 8', src: 'assets/avatars/9963629.jpg'  },
    { value: 'd2090ffb', label: 'Avatar 9', src: 'assets/avatars/d2090ffb.jpg' }
  ];

  readonly adminAvatarOptions: AvatarOption[] = [
    { value: 'admin-voir', label: 'Admin GIF', src: 'assets/avatars/admin/voir.gif' }
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.applyPreferences(this.auth.getCurrentUser()?.preferences || null);
    if ('Notification' in window) {
      this.pushPermission.set(Notification.permission);
    }
    this.preferencesApi.getMyPreferences().subscribe({
      next: (prefs) => {
        this.applyPreferences(prefs);
        this.auth.updateCurrentUser({ preferences: prefs });
      },
      error: () => {}
    });
  }

  // ── Sélecteurs ────────────────────────────────────────────────────────────
  selectTheme(value: ThemeChoice): void {
    if (!this.themeOptions().some(o => o.value === value)) return;
    this.theme.set(value);
    this.save({ themeOverride: value === 'auto' ? null : value });
  }
  selectDensity(value: DensityChoice): void {
    this.density.set(value);
    this.save({ density: value });
  }
  selectMotion(value: MotionChoice): void {
    this.motion.set(value);
    this.save({ motion: value });
  }
  selectAvatar(value: AvatarChoice): void {
    this.avatar.set(value);
    this.save({ avatar: value });
  }
  selectFontSize(value: FontSizeChoice): void {
    this.fontSize.set(value);
    this.save({ fontSize: value });
  }
  selectDateFormat(value: DateFormatChoice): void {
    this.dateFormat.set(value);
    this.save({ dateFormat: value });
  }
  selectDecimalSeparator(value: DecimalSeparatorChoice): void {
    this.decimalSeparator.set(value);
    this.save({ decimalSeparator: value });
  }
  selectDefaultPage(value: string): void {
    const page = value || null;
    this.defaultPage.set(page);
    this.save({ defaultPage: page });
  }
  selectTablePageSize(value: TablePageSizeChoice): void {
    this.tablePageSize.set(value);
    this.save({ tablePageSize: value });
  }
  togglePushNotifications(): void {
    if (!this.pushNotifications() && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        this.pushPermission.set(permission);
        if (permission === 'granted') {
          this.pushNotifications.set(true);
          this.save({ pushNotifications: true });
        }
      });
      return;
    }
    const next = !this.pushNotifications();
    this.pushNotifications.set(next);
    this.save({ pushNotifications: next });
  }
  toggleSoundAlerts(): void {
    const next = !this.soundAlerts();
    this.soundAlerts.set(next);
    this.save({ soundAlerts: next });
  }
  updateStockThreshold(value: string): void {
    const num = value === '' ? null : parseFloat(value);
    const threshold = num === null || isNaN(num) ? null : Math.max(0, num);
    this.stockAlertThreshold.set(threshold);
    this.save({ stockAlertThreshold: threshold });
  }
  toggleHighContrast(): void {
    const next = !this.highContrast();
    this.highContrast.set(next);
    this.save({ highContrast: next });
  }
  toggleKeyboardShortcuts(): void {
    const next = !this.keyboardShortcuts();
    this.keyboardShortcuts.set(next);
    this.save({ keyboardShortcuts: next });
  }
  selectAutoLogout(value: AutoLogoutChoice): void {
    this.autoLogout.set(value);
    this.save({ autoLogout: value });
  }
  toggleConfirmDelete(): void {
    const next = !this.confirmDelete();
    this.confirmDelete.set(next);
    this.save({ confirmDelete: next });
  }

  resetAll(): void {
    const rollback = this.currentPreferences();
    this.theme.set('auto');
    this.density.set('comfortable');
    this.motion.set('full');
    this.avatar.set(null);
    this.fontSize.set('normal');
    this.dateFormat.set('dmy');
    this.decimalSeparator.set('comma');
    this.defaultPage.set(null);
    this.tablePageSize.set(20);
    this.pushNotifications.set(false);
    this.soundAlerts.set(false);
    this.stockAlertThreshold.set(null);
    this.highContrast.set(false);
    this.keyboardShortcuts.set(true);
    this.autoLogout.set('never');
    this.confirmDelete.set(true);
    this.updatePreferences({
      themeOverride: null, density: 'comfortable', motion: 'full', avatar: null,
      fontSize: 'normal', dateFormat: 'dmy', decimalSeparator: 'comma',
      defaultPage: null, tablePageSize: 20,
      pushNotifications: false, soundAlerts: false, stockAlertThreshold: null,
      highContrast: false, keyboardShortcuts: true,
      autoLogout: 'never', confirmDelete: true
    }, rollback);
  }

  // ── Internals ─────────────────────────────────────────────────────────────
  private save(patch: Partial<UserPreferences>): void {
    this.updatePreferences(patch, this.currentPreferences());
  }

  private currentPreferences(): UserPreferences {
    const choice = this.theme();
    return {
      themeOverride:       choice === 'auto' ? null : (choice as Exclude<ThemeChoice, 'auto'>),
      density:             this.density(),
      motion:              this.motion(),
      avatar:              this.avatar(),
      fontSize:            this.fontSize(),
      dateFormat:          this.dateFormat(),
      decimalSeparator:    this.decimalSeparator(),
      defaultPage:         this.defaultPage(),
      tablePageSize:       this.tablePageSize(),
      pushNotifications:   this.pushNotifications(),
      soundAlerts:         this.soundAlerts(),
      stockAlertThreshold: this.stockAlertThreshold(),
      highContrast:        this.highContrast(),
      keyboardShortcuts:   this.keyboardShortcuts(),
      autoLogout:          this.autoLogout(),
      confirmDelete:       this.confirmDelete()
    };
  }

  private applyPreferences(prefs: UserPreferences | null): void {
    const themeOverride = prefs?.themeOverride ?? null;
    this.theme.set(themeOverride ?? 'auto');
    this.density.set(prefs?.density || 'comfortable');
    this.motion.set(prefs?.motion || 'full');
    this.avatar.set(prefs?.avatar ?? null);
    this.fontSize.set(prefs?.fontSize || 'normal');
    this.dateFormat.set(prefs?.dateFormat || 'dmy');
    this.decimalSeparator.set(prefs?.decimalSeparator || 'comma');
    this.defaultPage.set(prefs?.defaultPage ?? null);
    this.tablePageSize.set(prefs?.tablePageSize || 20);
    this.pushNotifications.set(prefs?.pushNotifications ?? false);
    this.soundAlerts.set(prefs?.soundAlerts ?? false);
    this.stockAlertThreshold.set(prefs?.stockAlertThreshold ?? null);
    this.highContrast.set(prefs?.highContrast ?? false);
    this.keyboardShortcuts.set(prefs?.keyboardShortcuts ?? true);
    this.autoLogout.set(prefs?.autoLogout || 'never');
    this.confirmDelete.set(prefs?.confirmDelete ?? true);
  }

  private updatePreferences(patch: Partial<UserPreferences>, rollback: UserPreferences): void {
    const optimistic: UserPreferences = { ...rollback, ...patch };
    this.auth.updateCurrentUser({ preferences: optimistic });
    this.preferencesApi.updateMyPreferences(patch).subscribe({
      next: (prefs) => {
        this.applyPreferences(prefs);
        this.auth.updateCurrentUser({ preferences: prefs });
      },
      error: () => {
        this.applyPreferences(rollback);
        this.auth.updateCurrentUser({ preferences: rollback });
      }
    });
  }
}
