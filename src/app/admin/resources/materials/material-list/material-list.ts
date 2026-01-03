// material-list
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { MaterialService, MaterialFilter } from '../../../../core/services/material.service';
import { DepotService } from '../../../../core/services/depot.service';
import {Material, Depot} from '../../../../core/models';
import {ConfirmDeleteModal} from '../../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import {DetailBack} from '../../../../core/utils/detail-back';
import { AuthService } from '../../../../core/services/auth.service';
import { Role } from '../../../../core/models/roles.model';
import { formatResourceName, formatDepotName } from '../../../../core/utils/text-format';
import { downloadBlob } from '../../../../core/utils/download';

@Component({
  standalone: true,
  selector: 'app-material-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './material-list.html',
  styleUrls: ['./material-list.scss'],
})
export class MaterialList extends DetailBack {

  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');
  readonly pendingDeleteLabel = signal<string>('élément');

  private materialService = inject(MaterialService);
  private depotSvc = inject(DepotService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  // -----------------------------
  // Signals du service (source de vérité)
  // -----------------------------
  readonly loading = this.materialService.loading;
  readonly error = this.materialService.error;
  readonly result = this.materialService.result; // Signal<MaterialListResult | null>

  // -----------------------------
  // UI state local
  // -----------------------------
  readonly deletingId = signal<string | null>(null);

  // Pagination
  readonly page = signal(1);
  readonly limit = signal(25);

  // Depots (filtre)
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  // Filtres (q + depot) — même pattern que consumable-list
  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control(''),
    depot: this.fb.nonNullable.control(''),
  });

  // -----------------------------
  // Derived data (toujours depuis result)
  // -----------------------------
  readonly items = computed(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  // Boutons pager (désactivation propre)
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly isDepotManager = computed(() => this.auth.getUserRole() === Role.GESTION_DEPOT);

  constructor() {
    super();
    if (!this.isDepotManager()) {
      this.loadDepots();
    }
    this.refresh(true);
  }

  openDeleteModal(m: Material): void {
    if (this.isDepotManager()) return;
    this.pendingDeleteLabel.set(m._id);
    this.pendingDeleteId.set(m._id);
    this.pendingDeleteName.set(m.name ?? '');
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
  }

  confirmDelete(): void {
    if (this.isDepotManager()) return;
    const id = this.pendingDeleteId();
    if (!id) return;

    this.deleteModalOpen.set(false);
    this.deletingId.set(id);

    // ⚠️ adapte ici selon le service de la page
    this.materialService.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.refresh(true);
        this.closeDeleteModal();
      },
      error: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
      }
    });
  }

  // -----------------------------
  // Chargement liste (paginée + filtres)
  // -----------------------------
  refresh(force = false): void {
    const { q, depot } = this.filterForm.getRawValue();

    const filter: MaterialFilter = {
      q: q.trim() || undefined,
      depot: depot || undefined,
      page: this.page(),
      limit: this.limit(),
    };

    this.materialService.refresh(force, filter).subscribe({ error: () => {} });
  }

  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({ q: '', depot: '' });
    this.page.set(1);
    this.refresh(true);
  }

  // -----------------------------
  // Pagination
  // -----------------------------
  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh(true);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.refresh(true);
  }

  onLimitChange(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;

    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;

    this.limit.set(v);
    this.page.set(1);
    this.refresh(true);
  }

  // -----------------------------
  // Actions
  // -----------------------------
  openDetail(m: Material): void {
    const base = this.isDepotManager() ? '/depot/resources/materials' : '/admin/resources/materials';
    const tail = this.isDepotManager() ? ['detail'] : [];
    this.router.navigate([base, m._id, ...tail]).then();
  }

  createNew(): void {
    if (this.isDepotManager()) return;
    this.router.navigate(['/admin/resources/materials/new']).then();
  }

  exportCsv(): void {
    const { q, depot } = this.filterForm.getRawValue();
    this.materialService.exportCsv({
      q: q.trim() || undefined,
      depot: depot || undefined
    }).subscribe({
      next: (blob) => downloadBlob(blob, `materials-${new Date().toISOString().slice(0, 10)}.csv`),
      error: () => {}
    });
  }

  exportPdf(): void {
    const { q, depot } = this.filterForm.getRawValue();
    this.materialService.exportPdf({
      q: q.trim() || undefined,
      depot: depot || undefined
    }).subscribe({
      next: (blob) => downloadBlob(blob, `materials-${new Date().toISOString().slice(0, 10)}.pdf`),
      error: () => {}
    });
  }

  // ✅ route edit: /admin/resources/materials/:id/edit (comme consumables)
  edit(m: Material): void {
    if (this.isDepotManager()) return;
    this.router.navigate(['/admin/resources/materials', m._id, 'edit']).then();
  }

  delete(m: Material): void {
    if (this.isDepotManager()) return;
    this.deletingId.set(m._id);

    this.materialService.remove(m._id).subscribe({
      next: () => {
        this.deletingId.set(null);

        // Si tu supprimes le dernier item de la dernière page, tu peux revenir d’une page
        // (optional). Ici simple refresh.
        this.refresh(true);
      },
      error: () => this.deletingId.set(null),
    });
  }

  // -----------------------------
  // Erreur “propre” (0 any)
  // -----------------------------
  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';

    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';

    return apiMsg || err.message || 'Erreur inconnue';
  }

  createdAtValue(m: Material): string | Date | null {
    return m.createdAt ?? null;
  }

  depotLabel(m: Material): string {
    const d = m.idDepot;
    if (!d) return '—';

    // populate → objet { _id, name }
    if (typeof d === 'object' && '_id' in d) {
      const obj: { _id: string; name?: string } = d;
      return formatDepotName(obj.name) || '—';
    }

    return '—';
  }

  materialName(m: Material): string {
    return formatResourceName(m.name) || '—';
  }

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }

  // -----------------------------
  // Depots pour le filtre
  // -----------------------------
  private loadDepots(): void {
    if (this.isDepotManager()) return;
    this.depotsLoading.set(true);

    this.depotSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  trackById = (_: number, m: Material) => m._id;
}
