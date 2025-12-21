import { CommonModule, DatePipe } from '@angular/common';
import { Component, Signal, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {MaterialService} from '../../../../core/services/material.service';
import {MaterialListResult} from '../../../../core/models/material-list-result-model';
import {Material} from '../../../../core/models';
import {ConfirmDeleteModal} from '../../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import {DATE_FORMAT_FR} from '../../../../core/constant/date-format';

@Component({
  standalone: true,
  selector: 'app-materials-list',
  providers: [DatePipe, ConfirmDeleteModal],
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ConfirmDeleteModal],
  templateUrl: './materials-list.html',
  styleUrls: ['./materials-list.scss']
})
export class MaterialsList {
  private materialService = inject(MaterialService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private datePipe = inject(DatePipe);

  // --- signals service
  readonly loading = this.materialService.loading;
  readonly error = this.materialService.error;
  readonly result: Signal<MaterialListResult | null> = this.materialService.result;

  // UI: modal suppression
  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');

  // --- filtres + pagination
  readonly filterForm = this.fb.nonNullable.group({
    q: this.fb.nonNullable.control('')
  });

  readonly page = signal<number>(1);
  readonly limit = signal<number>(25);

  // --- computed
  readonly items = computed<Material[]>(() => this.result()?.items ?? []);
  readonly total = computed<number>(() => this.result()?.total ?? 0);
  readonly pageCount = computed<number>(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly deletingId = signal<string | null>(null);

  constructor() {
    this.refresh(true);
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '';
    return this.datePipe.transform(date, DATE_FORMAT_FR) ?? '';
  }

  refresh(force = false): void {
    const q = this.filterForm.controls.q.value.trim();

    this.materialService.refresh(force, {
      q: q || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      error: () => {
        // erreur déjà stockée dans svc.error()
      }
    });
  }

  // --- actions UI
  search(): void {
    this.page.set(1);
    this.refresh(true);
  }

  clearSearch(): void {
    this.filterForm.reset({ q: '' });
    this.page.set(1);
    this.refresh(true);
  }

// boutons
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

// navigation (sécurisée)
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

  createNew(): void {
    this.router.navigate(['/admin/resources/materials/new']);
  }

  openDetail(m: Material): void {
    // route détail (à ajouter dans admin.routes.ts si pas encore)
    this.router.navigate(['/admin/resources/materials', m._id, 'detail']);
  }

  edit(m: Material): void {
    this.router.navigate(['/admin/resources/materials', m._id, 'edit']);
  }

  askDelete(m: Material): void {
    this.pendingDeleteId.set(m._id);
    this.pendingDeleteName.set(m.name ?? 'Matériel');
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

    this.materialService.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.refresh(true);
        this.pendingDeleteId.set(null);
        this.pendingDeleteName.set('');
      },
      error: () => {
        this.deletingId.set(null);
        // tu peux rouvrir si tu veux, mais en général non
        this.pendingDeleteId.set(null);
        this.pendingDeleteName.set('');
      }
    });
  }
  // --- helpers template (0 any)
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

  trackById = (_: number, m: Material) => m._id;
}
