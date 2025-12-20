// consumables-list.ts
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {ConsumableService} from '../../../../core/services/consumable.service';
import {Consumable} from '../../../../core/models';

@Component({
  standalone: true,
  selector: 'app-consumables-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule],
  templateUrl: './consumables-list.html',
  styleUrls: ['./consumables-list.scss']
})
export class ConsumablesList {
  private svc = inject(ConsumableService);
  private router = inject(Router);

  // Signals du service
  readonly items: Signal<Consumable[]> = this.svc.items;
  readonly list = computed(() => this.items() ?? []);
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;

  // UI state local
  readonly deletingId = signal<string | null>(null);

  // exemples : filtre dépôt plus tard (select)
  readonly depotId = signal<string>('');

  // computed utiles
  readonly hasError = computed(() => this.error() !== null);

  constructor() {
    // charge au montage
    this.refresh(true);
  }

  refresh(force = false): void {
    this.svc.refresh(force, { idDepot: this.depotId() || undefined }).subscribe({
      // pas besoin de next: le service met à jour les signals
      error: () => {}
    });
  }

  createNew(): void {
    // branche ton form plus tard
    this.router.navigate(['/admin/resources/consumables/new']);
  }

  // Helpers pour éviter accès profond en HTML
  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';
    // backend renvoie {message:"..."} souvent dans err.error
    const apiMsg =
      typeof err.error === 'object' && err.error && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  depotLabel(c: Consumable): string {
    const d = c.idDepot;
    if (!d) return '—';

    if (typeof d === 'string') return '—'; // pas peuplé
    return d.name ?? '—';                  // peuplé
  }


  createdAtValue(c: Consumable): string | Date | null {
    return c.createdAt ?? null;
  }

  delete(c: Consumable): void {
    this.deletingId.set(c._id);

    this.svc.remove(c._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.refresh(true);
      },
      error: () => {
        this.deletingId.set(null);
      }
    });
  }

  back(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  trackById = (_: number, c: Consumable) => c._id;
}
