import { computed, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { Consumable } from '../models/consumable.model';
import { Material } from '../models/material.model';

export interface AppNotifEvent {
  title: string;
  body: string;
  /** Icône affichée dans la notification navigateur (chemin relatif à l'app) */
  icon?: string;
  /** Clé de déduplication : une seule notification par clé dans la session */
  dedupKey?: string;
  /** Joue le son même si soundAlerts est désactivé globalement */
  forcSound?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppNotificationService {
  private auth   = inject(AuthService);
  private http   = inject(HttpClient);
  private apiBase = (environment.apiBaseUrl || '').replace(/\/+$/, '');

  /** Clés déjà notifiées dans cette session (déduplique) */
  private sentKeys = new Set<string>();

  private readonly pushEnabled  = computed(() => this.auth.user$()?.preferences?.pushNotifications  ?? false);
  private readonly soundEnabled = computed(() => this.auth.user$()?.preferences?.soundAlerts        ?? false);
  readonly stockThreshold       = computed(() => this.auth.user$()?.preferences?.stockAlertThreshold ?? null);

  // ── API publique ────────────────────────────────────────────────────────────

  /**
   * Envoie une notification navigateur + joue un son selon les préférences.
   * Si `dedupKey` est fournie, la notification n'est envoyée qu'une fois par session.
   */
  notify(event: AppNotifEvent): void {
    const { title, body, icon, dedupKey, forcSound } = event;

    if (dedupKey && this.sentKeys.has(dedupKey)) return;
    if (dedupKey) this.sentKeys.add(dedupKey);

    if ((this.soundEnabled() || forcSound) && typeof AudioContext !== 'undefined') {
      this.beep();
    }

    if (this.pushEnabled() && this.canNotify()) {
      try {
        new Notification(title, {
          body,
          icon: icon ?? '/assets/icons/icon-72x72.png',
          badge: '/assets/icons/icon-72x72.png',
          tag: dedupKey,
        });
      } catch {
        // Silencieux si la notification échoue (contexte sécurisé requis)
      }
    }
  }

  /**
   * Vérifie les consommables / matériels contre le seuil d'alerte stock.
   * Appeler après chaque rechargement de données.
   */
  checkStockAlerts(
    consumables: Consumable[],
    materials:   Material[],
    sessionKey:  string = 'stock'
  ): void {
    const threshold = this.stockThreshold();
    if (threshold === null || threshold === undefined) return;

    const lowConsumables = consumables.filter(
      c => typeof c.quantity === 'number' && c.quantity <= threshold
    );
    const lowMaterials = materials.filter(
      m => typeof m.quantity === 'number' && m.quantity <= threshold
    );

    const total = lowConsumables.length + lowMaterials.length;
    if (total === 0) return;

    const dedupKey = `${sessionKey}-${total}-${threshold}`;

    const names = [
      ...lowConsumables.map(c => c.name),
      ...lowMaterials.map(m => m.name)
    ].slice(0, 3).join(', ');

    this.notify({
      title: `⚠️ Alerte stock — ${total} article${total > 1 ? 's' : ''} sous le seuil`,
      body: `${names}${total > 3 ? ` et ${total - 3} autre(s)` : ''} (seuil : ${threshold} unités)`,
      icon: '/assets/icons/icon-72x72.png',
      dedupKey,
    });
  }

  /**
   * Notification simple pour une action réussie (ex: demande créée, décision envoyée).
   */
  notifyAction(title: string, body: string, dedupKey?: string): void {
    this.notify({ title, body, dedupKey });
  }

  /** Vide les clés de déduplication (utile après logout). */
  clearSession(): void {
    this.sentKeys.clear();
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private canNotify(): boolean {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  /**
   * Bip court généré par le Web Audio API — aucun fichier audio nécessaire.
   * Deux tons successifs (accord mineur) pour signaler une alerte.
   */
  beep(type: 'alert' | 'success' | 'info' = 'info'): void {
    if (typeof AudioContext === 'undefined' && typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext === 'undefined') return;
    try {
      const AudioCtx = typeof AudioContext !== 'undefined'
        ? AudioContext
        : (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx  = new AudioCtx();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      const freqs: Record<typeof type, number[]> = {
        alert:   [880, 660],   // descendant = alerte
        success: [660, 880],   // montant   = succès
        info:    [740, 740],   // neutre
      };

      freqs[type].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime  + i * 0.18 + 0.18);
      });

      // Ferme le contexte audio après la lecture pour libérer les ressources
      setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch {
      // Silencieux (restriction autoplay, etc.)
    }
  }

  // ── Polling stock (appelé depuis app.ts) ────────────────────────────────────

  /**
   * Vérifie les stocks en arrière-plan et notifie si sous le seuil.
   * Appelé périodiquement par app.ts uniquement quand un seuil est défini.
   */
  pollStockAlerts(): void {
    const threshold = this.stockThreshold();
    if (threshold === null || threshold === undefined) return;
    const role = this.auth.user$()?.role;
    if (!role) return;

    this.http.get<{ items: Consumable[] }>(
      `${this.apiBase}/consumables?limit=200&lowStock=true&threshold=${threshold}`
    ).subscribe({
      next: (res) => {
        this.checkStockAlerts(res?.items ?? [], [], 'poll');
      },
      error: () => {}
    });
  }
}
