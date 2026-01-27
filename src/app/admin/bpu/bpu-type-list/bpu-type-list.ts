import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BpuType } from '../../../core/models';
import { BpuTypeService } from '../../../core/services/bpu-type.service';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-bpu-type-list',
  imports: [CommonModule, RouterModule, ConfirmDeleteModal],
  templateUrl: './bpu-type-list.html',
  styleUrl: './bpu-type-list.scss'
})
export class BpuTypeList {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private svc = inject(BpuTypeService);

  readonly items = signal<BpuType[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal('');
  readonly deletingId = signal<string | null>(null);

  readonly sortedItems = computed(() => {
    const list = [...this.items()];
    list.sort((a, b) => String(a.type || '').localeCompare(String(b.type || '')));
    return list;
  });

  constructor() {
    const saved = this.route.snapshot.queryParamMap.get('saved');
    if (saved) {
      this.success.set('BPU enregistré avec succès.');
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.apiError(err, 'Erreur chargement BPU'));
        this.loading.set(false);
      }
    });
  }

  createNew(): void {
    this.router.navigate(['/admin/bpu/new']);
  }

  edit(item: BpuType): void {
    const segment = String(item.type || '').trim().toUpperCase();
    if (segment === 'AUTO' || segment === 'SALARIE') {
      this.router.navigate(['/admin/bpu/new'], { queryParams: { segment } }).then();
      return;
    }
    if (!item._id) return;
    this.router.navigate(['/admin/bpu', item._id, 'edit']);
  }

  openDeleteModal(item: BpuType): void {
    if (!item._id) return;
    this.pendingDeleteId.set(item._id);
    this.pendingDeleteName.set(item.type || '');
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
    this.svc.remove(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.closeDeleteModal();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingId.set(null);
        this.error.set(this.apiError(err, 'Erreur suppression BPU'));
        this.closeDeleteModal();
      }
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
