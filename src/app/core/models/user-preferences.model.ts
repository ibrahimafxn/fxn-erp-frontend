export type ThemeOverride = 'default' | 'admin' | 'dirigeant' | 'gestion-depot' | 'technicien' | null;
export type DensityChoice = 'comfortable' | 'compact';
export type MotionChoice = 'full' | 'reduced';
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

export interface UserPreferences {
  themeOverride: ThemeOverride;
  density: DensityChoice;
  motion: MotionChoice;
  avatar: AvatarChoice;
}
