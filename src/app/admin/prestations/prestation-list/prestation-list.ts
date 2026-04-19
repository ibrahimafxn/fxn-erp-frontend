import { Component, Signal, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { catchError, map, of } from 'rxjs';

import { PrestationService } from '../../../core/services/prestation.service';
import { PrestationCatalogService } from '../../../core/services/prestation-catalog.service';
import { Prestation, PrestationCatalog, PrestationListResult } from '../../../core/models';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { DetailBack } from '../../../core/utils/detail-back';
import { PaginationState } from '../../../core/utils/pagination-state';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-prestation-list',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './prestation-list.html',
  styleUrls: ['./prestation-list.scss']
})
export class PrestationList extends DetailBack {
  private svc = inject(PrestationService);
  private catalogService = inject(PrestationCatalogService);
  private fb = inject(FormBuilder);

  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly result: Signal<PrestationListResult | null> = this.svc.result;
  readonly usesCatalogApi = signal(false);

  readonly deletingId = signal<string | null>(null);
  private readonly pag = new PaginationState();
  readonly page = this.pag.page;
  readonly limit = this.pag.limit;
  readonly pageRange = this.pag.pageRange;

  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control('')
  });

  readonly items = computed(() => (this.result()?.items ?? []) as Prestation[]);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = this.pag.pageCount;
  readonly canPrev = this.pag.canPrev;
  readonly canNext = this.pag.canNext;

  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');

  constructor() {
    super();
    this.refresh(true);
  }

  refresh(force = false): void {
    const { q } = this.filterForm.getRawValue();
    this.catalogService.list({
      q: q.trim() || undefined,
      page: this.page(),
      limit: this.limit()
    }).pipe(
      map((catalogResult) => this.mapCatalogToLegacyResult(catalogResult)),
      catchError(() => this.svc.refreshPrestations(force, {
        q: q.trim() || undefined,
        page: this.page(),
        limit: this.limit()
      }).pipe(
        map((legacyResult) => {
          this.usesCatalogApi.set(false);
          return legacyResult;
        })
      ))
    ).subscribe({
      next: (result) => {
        if (result.items.some((item) => 'segment' in item || 'libelle' in item)) {
          this.usesCatalogApi.set(true);
        }
        (this.svc as any)._result.set(result);
      },
      error: () => {}
    });
  }

  search(): void {
    this.pag.resetPage();
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.setValue({ q: '' });
    this.pag.resetPage();
    this.refresh(true);
  }

  prevPage(): void {
    this.pag.prevPage(() => this.refresh(true));
  }

  nextPage(): void {
    this.pag.nextPage(() => this.refresh(true));
  }

  setLimit(v: number): void {
    this.pag.setLimitValue(v, () => this.refresh(true));
  }

  createNew(): void {
    this.router.navigate(['/admin/prestations/new']);
  }

  edit(p: Prestation): void {
    this.router.navigate(['/admin/prestations', p._id, 'edit']);
  }

  openDeleteModal(p: Prestation): void {
    this.pendingDeleteId.set(p._id);
    this.pendingDeleteName.set(p.designation || p.code || '');
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
  }

  confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id) return;

    this.deleteModalOpen.set(false);
    this.deletingId.set(id);

    this.svc.deletePrestation(id).subscribe({
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

  errorMessage(): string {
    const err: HttpErrorResponse | null = this.error();
    if (!err) return '';
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || 'Erreur inconnue';
  }

  formatPrix(p: Prestation): string {
    if (p.prix === null || p.prix === undefined) return '—';
    return `${p.prix.toFixed(2)} €`;
  }

  designationLabel(p: Prestation): string {
    return p.designation || p.code || '';
  }

  segmentLabel(p: Prestation): string {
    return (p as Prestation & { segment?: string }).segment || '—';
  }

  statusLabel(p: Prestation): string {
    const active = (p as Prestation & { active?: boolean }).active;
    if (typeof active !== 'boolean') return '—';
    return active ? 'Actif' : 'Inactif';
  }

  trackById = (_: number, p: Prestation) => p._id;

  private mapCatalogToLegacyResult(result: { total: number; page: number; limit: number; items: PrestationCatalog[] }): PrestationListResult {
    return {
      total: result.total,
      page: result.page,
      limit: result.limit,
      items: result.items.map((item) => ({
        _id: item.id,
        code: item.code,
        designation: item.libelle,
        prix: item.prixUnitaireBase,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        segment: item.segment,
        active: item.active
      } as Prestation))
    };
  }
}
