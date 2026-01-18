import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { DepotService } from '../../../core/services/depot.service';
import { Role } from '../../../core/models/roles.model';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private auth = inject(AuthService);
  private router = inject(Router);
  private depotService = inject(DepotService);
  private http = inject(HttpClient);
  private apiBase = (environment.apiBaseUrl || '').replace(/\/+$/, '');

  readonly user = this.auth.user$;
  readonly depotName = signal('—');
  readonly depotLoading = signal(false);
  private lastDepotId: string | null = null;

  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '—';
    return formatPersonName(u.firstName ?? '', u.lastName ?? '') || u.email;
  });

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  });

  readonly photoUrl = computed(() => {
    const u = this.user();
    return u?.photoUrl || u?.avatarUrl || '';
  });

  readonly roleLabel = computed(() => {
    switch (this.user()?.role) {
      case Role.DIRIGEANT: return 'Dirigeant';
      case Role.ADMIN: return 'Administrateur';
      case Role.GESTION_DEPOT: return 'Gestion dépôt';
      case Role.TECHNICIEN: return 'Technicien';
      default: return '—';
    }
  });

  readonly accessItems = computed(() => {
    const role = this.user()?.role;
    if (role === Role.ADMIN || role === Role.DIRIGEANT) {
      return [
        { icon: 'key', label: 'Accès utilisateurs', desc: 'Gestion des comptes et droits' },
        { icon: 'swap_horiz', label: 'Mouvements', desc: 'Historique des flux et réservations' },
        { icon: 'report', label: 'Alertes', desc: 'Suivi des stocks et anomalies' }
      ];
    }
    if (role === Role.GESTION_DEPOT) {
      return [
        { icon: 'inventory_2', label: 'Stock dépôt', desc: 'Suivi quotidien du stock' },
        { icon: 'widgets', label: 'Réservations', desc: 'Attribution des consommables' },
        { icon: 'handyman', label: 'Matériels', desc: 'Gestion des outils et EPI' }
      ];
    }
    if (role === Role.TECHNICIEN) {
      return [
        { icon: 'assignment', label: 'Réservations', desc: 'Consommables attribués' },
        { icon: 'car_repair', label: 'Véhicule', desc: 'Suivi de l’affectation' },
        { icon: 'support_agent', label: 'Support', desc: 'Contact administrateur' }
      ];
    }
    return [];
  });

  readonly uploadLoading = signal(false);
  readonly uploadError = signal<string | null>(null);

  private readonly depotSync = effect(() => {
    const idDepot = this.user()?.idDepot ?? null;
    if (!idDepot || typeof idDepot !== 'string') {
      this.lastDepotId = null;
      this.depotName.set('—');
      return;
    }
    if (idDepot === this.lastDepotId) return;
    this.lastDepotId = idDepot;
    this.depotLoading.set(true);
    this.depotService.getDepot(idDepot).subscribe({
      next: (depot) => {
        const name = formatDepotName(depot?.name || '') || depot?.name || idDepot;
        this.depotName.set(name);
        this.depotLoading.set(false);
      },
      error: () => {
        this.depotName.set(idDepot);
        this.depotLoading.set(false);
      }
    });
  });

  goHome(): void {
    const role = this.auth.getUserRole();
    if (role === Role.ADMIN || role === Role.DIRIGEANT) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    if (role === Role.GESTION_DEPOT) {
      this.router.navigate(['/depot']);
      return;
    }
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout(true).subscribe();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Format invalide (PNG ou JPG).');
      if (input) input.value = '';
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    this.uploadLoading.set(true);
    this.uploadError.set(null);

    this.compressImage(file)
      .then((compressed) => {
        if (compressed.size > maxSize) {
          this.uploadLoading.set(false);
          this.uploadError.set('Fichier trop lourd (max 5 Mo) même après compression.');
          if (input) input.value = '';
          return;
        }

        const formData = new FormData();
        formData.append('file', compressed);

        this.http.post<{ success: boolean; data?: { photoUrl?: string; avatarUrl?: string } }>(
          `${this.apiBase}/users/me/avatar`,
          formData
        ).subscribe({
          next: (res) => {
            const url = res?.data?.photoUrl || res?.data?.avatarUrl || '';
            if (url) {
              this.auth.updateCurrentUser({ photoUrl: url, avatarUrl: url });
            }
            this.uploadLoading.set(false);
            if (input) input.value = '';
          },
          error: (err: HttpErrorResponse) => {
            this.uploadLoading.set(false);
            this.uploadError.set(this.apiError(err, 'Erreur upload photo'));
            if (input) input.value = '';
          }
        });
      })
      .catch(() => {
        this.uploadLoading.set(false);
        this.uploadError.set('Impossible de compresser la photo.');
        if (input) input.value = '';
      });
  }

  private compressImage(file: File): Promise<File> {
    const maxDim = 512;
    const quality = 0.82;
    const blobUrl = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const targetW = Math.max(1, Math.round(img.width * scale));
          const targetH = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas non disponible'));
            return;
          }
          ctx.drawImage(img, 0, 0, targetW, targetH);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Compression échouée'));
              return;
            }
            const safeName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
            resolve(new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' }));
          }, 'image/jpeg', quality);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Image invalide'));
      };
      img.src = blobUrl;
    });
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
