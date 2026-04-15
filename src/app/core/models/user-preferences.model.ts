// ─── Catalogue des thèmes ────────────────────────────────────────────────────
// Ajouter un thème ici suffit pour le frontend (app.ts + preferences.ts).
// Ne pas oublier : _tokens.scss (variables CSS) + backend (enum Mongoose + validator).

export const THEME_OVERRIDES = [
  'default',
  'admin',
  'dirigeant',
  'gestion-depot',
  'technicien',
  'moderne',
  'aurore',
  'crepuscule',
  'glacier',
  'nuit',
  'rubis',
  'onyx'
] as const;

export type ThemeOverride = typeof THEME_OVERRIDES[number] | null;

export interface ThemeMeta {
  readonly value: string;
  readonly label: string;
  readonly desc: string;
  /** Visible par tous les rôles, pas seulement admin/dirigeant */
  readonly universal: boolean;
}

export const THEMES_META: readonly ThemeMeta[] = [
  { value: 'default',       label: 'Neutre clair',   desc: 'Palette claire et sobre.',                 universal: true  },
  { value: 'admin',         label: 'Administration', desc: 'Tons bleus profonds.',                     universal: false },
  { value: 'dirigeant',     label: 'Dirigeant',      desc: 'Accents rouges premium.',                  universal: false },
  { value: 'gestion-depot', label: 'Gestion dépôt', desc: 'Nuances turquoise énergétiques.',          universal: false },
  { value: 'technicien',    label: 'Technicien',     desc: 'Gris graphiques et discrets.',             universal: false },
  { value: 'moderne',       label: 'Moderne',        desc: 'Indigo électrique, design SaaS premium.',  universal: true  },
  { value: 'aurore',        label: 'Aurore',         desc: 'Émeraude arctique, ambiance boréale.',     universal: true  },
  { value: 'crepuscule',   label: 'Crépuscule',     desc: 'Dégradé orange-rose, coucher de soleil.',  universal: true  },
  { value: 'glacier',      label: 'Glacier',        desc: 'Blanc nacré et bleu givré, thème clair.',  universal: true  },
  { value: 'nuit',         label: 'Nuit',           desc: 'Bleu marine absolu, cyan pâle sobre.',      universal: true  },
  { value: 'rubis',        label: 'Rubis',          desc: 'Bordeaux profond, rouge rubis chaleureux.', universal: true  },
  { value: 'onyx',         label: 'Onyx',           desc: 'Ultra-noir luxe, accents or ambré.',        universal: true  },
];

// ─── Préférences d'affichage ──────────────────────────────────────────────────

export type DensityChoice = 'comfortable' | 'compact';
export type MotionChoice = 'full' | 'reduced';
export type FontSizeChoice = 'small' | 'normal' | 'large';
export type DateFormatChoice = 'dmy' | 'mdy' | 'relative';
export type DecimalSeparatorChoice = 'comma' | 'dot';

// ─── Préférences de navigation ────────────────────────────────────────────────

export type TablePageSizeChoice = 10 | 20 | 50 | 100;

// ─── Préférences de sécurité ──────────────────────────────────────────────────

export type AutoLogoutChoice = 'never' | '15' | '30' | '60';

// ─── Avatar ───────────────────────────────────────────────────────────────────

export type AvatarChoice =
  | '10491830'
  | '35480b05'
  | '9306614'
  | '9334178'
  | '9434619'
  | '9720027'
  | '9720029'
  | '9963629'
  | 'd2090ffb'
  | 'voir'
  | 'admin-voir'
  | null;

// ─── Interface principale ─────────────────────────────────────────────────────

export interface UserPreferences {
  // Existants
  themeOverride: ThemeOverride;
  density: DensityChoice;
  motion: MotionChoice;
  avatar: AvatarChoice;

  // Affichage
  fontSize: FontSizeChoice;
  dateFormat: DateFormatChoice;
  decimalSeparator: DecimalSeparatorChoice;

  // Navigation
  defaultPage: string | null;
  tablePageSize: TablePageSizeChoice;

  // Notifications
  pushNotifications: boolean;
  soundAlerts: boolean;
  stockAlertThreshold: number | null;

  // Accessibilité
  highContrast: boolean;
  keyboardShortcuts: boolean;

  // Sécurité
  autoLogout: AutoLogoutChoice;
  confirmDelete: boolean;
}
