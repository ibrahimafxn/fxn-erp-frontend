import { ChangeDetectionStrategy, Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { AvatarChoice, UserPreferences } from '../../core/models';
import { Role } from '../../core/models/roles.model';

type ThemeChoice = 'auto' | 'default' | 'admin' | 'dirigeant' | 'gestion-depot' | 'technicien';
type DensityChoice = 'comfortable' | 'compact';
type MotionChoice = 'full' | 'reduced';
type AvatarOption = { value: AvatarChoice; label: string; src: string };

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-preferences',
  imports: [CommonModule],
  templateUrl: './preferences.html',
  styleUrls: ['./preferences.scss']
})
export class Preferences implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly preferencesApi = inject(UserPreferencesService);

  readonly theme = signal<ThemeChoice>('auto');
  readonly density = signal<DensityChoice>('comfortable');
  readonly motion = signal<MotionChoice>('full');
  readonly avatar = signal<AvatarChoice>(null);
  readonly isAdmin = computed(() => {
    const role = this.auth.user$()?.role;
    return role === Role.ADMIN || role === Role.DIRIGEANT;
  });
  readonly isDepotManager = computed(() => this.auth.user$()?.role === Role.GESTION_DEPOT);

  private readonly allThemeOptions = [
    {
      value: 'auto' as const,
      label: 'Automatique (par rôle)',
      desc: 'Adapte les couleurs au profil connecté.'
    },
    {
      value: 'default' as const,
      label: 'Neutre clair',
      desc: 'Palette claire et sobre.'
    },
    {
      value: 'admin' as const,
      label: 'Administration',
      desc: 'Tons bleus profonds.'
    },
    {
      value: 'dirigeant' as const,
      label: 'Dirigeant',
      desc: 'Accents rouges premium.'
    },
    {
      value: 'gestion-depot' as const,
      label: 'Gestion dépôt',
      desc: 'Nuances turquoise énergétiques.'
    },
    {
      value: 'technicien' as const,
      label: 'Technicien',
      desc: 'Gris graphiques et discrets.'
    }
  ];
  readonly themeOptions = computed(() => {
    const role = this.auth.user$()?.role;
    if (role === Role.ADMIN || role === Role.DIRIGEANT) return this.allThemeOptions;
    const allowedByRole: Record<string, ThemeChoice> = {
      [Role.GESTION_DEPOT]: 'gestion-depot',
      [Role.TECHNICIEN]: 'technicien'
    };
    const ownTheme = role ? allowedByRole[role] : undefined;
    return this.allThemeOptions.filter((option) =>
      option.value === 'auto' || option.value === 'default' || option.value === ownTheme
    );
  });

  readonly densityOptions = [
    {
      value: 'comfortable' as const,
      label: 'Confortable',
      desc: 'Espacements standards pour la lecture.'
    },
    {
      value: 'compact' as const,
      label: 'Compacte',
      desc: 'Plus d\'informations à l\'écran.'
    }
  ];

  readonly motionOptions = [
    {
      value: 'full' as const,
      label: 'Animations complètes',
      desc: 'Transitions et effets visuels actifs.'
    },
    {
      value: 'reduced' as const,
      label: 'Animations réduites',
      desc: 'Moins d\'effets pour un confort accru.'
    }
  ];

  readonly avatarOptions: AvatarOption[] = [
    { value: '10491830', label: 'Avatar 1', src: 'assets/avatars/10491830.jpg' },
    { value: '35480b05', label: 'Avatar 2', src: 'assets/avatars/35480b05.jpg' },
    { value: '9306614', label: 'Avatar 3', src: 'assets/avatars/9306614.jpg' },
    { value: '9334178', label: 'Avatar 4', src: 'assets/avatars/9334178.jpg' },
    { value: '9434619', label: 'Avatar 5', src: 'assets/avatars/9434619.jpg' },
    { value: '9720027', label: 'Avatar 6', src: 'assets/avatars/9720027.jpg' },
    { value: '9720029', label: 'Avatar 7', src: 'assets/avatars/9720029.jpg' },
    { value: '9963629', label: 'Avatar 8', src: 'assets/avatars/9963629.jpg' },
    { value: 'd2090ffb', label: 'Avatar 9', src: 'assets/avatars/d2090ffb.jpg' }
  ];

  readonly adminAvatarOptions: AvatarOption[] = [
    { value: 'admin-voir', label: 'Admin GIF', src: 'assets/avatars/admin/voir.gif' }
  ];

  ngOnInit(): void {
    this.applyPreferences(this.auth.getCurrentUser()?.preferences || null);
    this.preferencesApi.getMyPreferences().subscribe({
      next: (prefs) => {
        this.applyPreferences(prefs);
        this.auth.updateCurrentUser({ preferences: prefs });
      },
      error: () => {}
    });
  }

  selectTheme(value: ThemeChoice): void {
    const allowed = this.themeOptions().some((option) => option.value === value);
    if (!allowed) return;
    const previous = this.currentPreferences();
    this.theme.set(value);
    this.updatePreferences({ themeOverride: value === 'auto' ? null : value }, previous);
  }

  selectDensity(value: DensityChoice): void {
    const previous = this.currentPreferences();
    this.density.set(value);
    this.updatePreferences({ density: value }, previous);
  }

  selectMotion(value: MotionChoice): void {
    const previous = this.currentPreferences();
    this.motion.set(value);
    this.updatePreferences({ motion: value }, previous);
  }

  selectAvatar(value: AvatarChoice): void {
    const previous = this.currentPreferences();
    this.avatar.set(value);
    this.updatePreferences({ avatar: value }, previous);
  }

  resetAll(): void {
    const previous = this.currentPreferences();
    this.theme.set('auto');
    this.density.set('comfortable');
    this.motion.set('full');
    this.avatar.set(null);
    this.updatePreferences({ themeOverride: null, density: 'comfortable', motion: 'full', avatar: null }, previous);
  }

  private currentPreferences(): UserPreferences {
    const choice = this.theme();
    const themeOverride = choice === 'auto' ? null : (choice as Exclude<ThemeChoice, 'auto'>);
    return {
      themeOverride,
      density: this.density(),
      motion: this.motion(),
      avatar: this.avatar()
    };
  }

  private applyPreferences(prefs: UserPreferences | null): void {
    const themeOverride = prefs?.themeOverride ?? null;
    this.theme.set(themeOverride ? themeOverride : 'auto');
    this.density.set(prefs?.density || 'comfortable');
    this.motion.set(prefs?.motion || 'full');
    this.avatar.set(prefs?.avatar ?? null);
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
