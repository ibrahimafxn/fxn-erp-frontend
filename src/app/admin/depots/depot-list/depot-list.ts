import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { DepotService } from '../../../core/services/depot.service';
import {Depot, DepotManager} from '../../../core/models';

@Component({
  standalone: true,
  selector: 'app-depot-list',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, DatePipe],
  templateUrl: './depot-list.html',
  styleUrls: ['./depot-list.scss']
})
export class DepotList {
  private depotService = inject(DepotService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly page = signal(1);
  readonly limit = signal(25);
  readonly deletingId = signal<string | null>(null);

  readonly filterForm = this.fb.group({ q: [''] });

  readonly loading = this.depotService.loading;
  readonly error = this.depotService.error;
  readonly result = this.depotService.result;

  readonly items = computed<Depot[]>(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(Math.ceil(t / l), 1) : 1;
  });

  constructor() {
    this.refresh(true);
  }

  refresh(force = false): void {
    const q = (this.filterForm.value.q || '').trim();
    this.depotService.refreshDepots(force, {
      q: q || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({ next: () => {}, error: () => {} });
  }

  search(): void {
    this.page.set(1);
    this.depotService.clearCache();
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.patchValue({ q: '' });
    this.search();
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.update(p => p - 1);
    this.refresh(true);
  }

  nextPage(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update(p => p + 1);
    this.refresh(true);
  }

  openDetail(d: Depot): void {
    this.router.navigate(['/admin/depots', d._id, 'view']).then(r => console.log(r));
  }

  createNew(): void {
    this.router.navigate(['/admin/depots/new']);
  }

  delete(d: Depot): void {
    if (!confirm(`Supprimer le dépôt "${d.name}" ?`)) return;

    this.deletingId.set(d._id);
    this.depotService.deleteDepot(d._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.depotService.clearCache();
        this.refresh(true);
      },
      error: () => this.deletingId.set(null)
    });
  }

  // -----------------------------
  // ✅ 0 any helpers
  // -----------------------------

  /** Type guard: managerId est un objet populate (UserLite) */
  isManagerObj(m: Depot['managerId']): m is DepotManager {
    return !!m && typeof m === 'object' && '_id' in m;
  }

  /** Label gestionnaire affichable sans cast HTML */
  managerLabel(d: Depot): string {
    const m = d.managerId;
    if (!m) return '—';
    if (!this.isManagerObj(m)) return '—'; // si string ObjectId, on affiche —
    const fn = m.firstName || '';
    const ln = m.lastName || '';
    return (fn + ' ' + ln).trim() || m.email || '—';
  }

  trackById = (_: number, d: Depot) => d._id;

  protected back() {
    this.router.navigate(['/admin/dashboard']);
  }
}
