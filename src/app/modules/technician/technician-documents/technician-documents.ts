import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { HrService } from '../../../core/services/hr.service';
import { EmployeeDoc } from '../../../core/models';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';

@Component({
  selector: 'app-technician-documents',
  standalone: true,
  imports: [CommonModule, TechnicianMobileNav],
  templateUrl: './technician-documents.html',
  styleUrl: './technician-documents.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnicianDocuments {
  private auth = inject(AuthService);
  private hr = inject(HrService);

  readonly docs = signal<EmployeeDoc[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly user = computed(() => this.auth.getCurrentUser());

  constructor() {
    this.load();
  }

  load(): void {
    const user = this.user();
    if (!user?._id) {
      this.error.set('Utilisateur introuvable.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.hr.listDocs({ user: user._id }).subscribe({
      next: (docs) => {
        this.docs.set(docs || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur chargement documents.');
        this.loading.set(false);
      }
    });
  }

  openDoc(doc: EmployeeDoc): void {
    this.hr.downloadDoc(doc._id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      },
      error: (err) => {
        this.readDownloadError(err)
          .then((msg) => this.error.set(msg))
          .catch(() => this.error.set('Téléchargement document impossible.'));
      }
    });
  }

  docLabel(doc: EmployeeDoc): string {
    return doc.detail || doc.type || 'Document';
  }

  isDocExpired(doc: EmployeeDoc): boolean {
    if (doc.valid === false) return true;
    if (!doc.expiryDate) return false;
    return new Date(doc.expiryDate).getTime() < Date.now();
  }

  isDocExpiringSoon(doc: EmployeeDoc, days = 30): boolean {
    if (doc.valid === false) return false;
    if (!doc.expiryDate) return false;
    const now = Date.now();
    const target = new Date(doc.expiryDate).getTime();
    if (target < now) return false;
    const threshold = now + days * 24 * 60 * 60 * 1000;
    return target <= threshold;
  }

  statusLabel(doc: EmployeeDoc): string {
    if (this.isDocExpired(doc)) return 'Expiré';
    if (this.isDocExpiringSoon(doc)) return 'Expire bientôt';
    return 'Valide';
  }

  statusClass(doc: EmployeeDoc): string {
    if (this.isDocExpired(doc)) return 'status-expired';
    if (this.isDocExpiringSoon(doc)) return 'status-expiring';
    return 'status-valid';
  }

  private async readDownloadError(err: any): Promise<string> {
    const payload = err?.error;
    if (payload instanceof Blob) {
      try {
        const text = await payload.text();
        const parsed = JSON.parse(text);
        return parsed?.message || 'Téléchargement document impossible.';
      } catch {
        return 'Téléchargement document impossible.';
      }
    }
    return payload?.message || 'Téléchargement document impossible.';
  }
}
