import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import {
  OsirisMappingService,
  OsirisCodeMapping,
  CreateMappingDto
} from '../../../core/services/osiris-mapping.service';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-osiris-mappings',
  imports: [CommonModule, RouterModule, FormsModule, ConfirmActionModal, ConfirmDeleteModal],
  templateUrl: './osiris-mappings.html',
  styleUrls: ['./osiris-mappings.scss']
})
export class OsirisMappings implements OnInit {
  private svc = inject(OsirisMappingService);

  readonly mappings = signal<OsirisCodeMapping[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Formulaire de création
  readonly formOpen = signal(false);
  readonly formOsirisCode = signal('');
  readonly formCanonicalCode = signal('');
  readonly formLabel = signal('');
  readonly formLoading = signal(false);
  readonly formError = signal<string | null>(null);

  // Edition inline
  readonly editId = signal<string | null>(null);
  readonly editCanonicalCode = signal('');
  readonly editLabel = signal('');
  readonly editLoading = signal(false);
  readonly editError = signal<string | null>(null);
  readonly deactivateModalOpen = signal(false);
  readonly deleteModalOpen = signal(false);
  readonly pendingDeactivate = signal<OsirisCodeMapping | null>(null);
  readonly pendingDelete = signal<OsirisCodeMapping | null>(null);
  readonly deactivateLoading = signal(false);
  readonly deleteLoading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.list().subscribe({
      next: (items) => {
        this.mappings.set(items);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message || 'Erreur chargement');
        this.loading.set(false);
      }
    });
  }

  openForm(): void {
    this.formOpen.set(true);
    this.formOsirisCode.set('');
    this.formCanonicalCode.set('');
    this.formLabel.set('');
    this.formError.set(null);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formError.set(null);
  }

  submitForm(): void {
    const dto: CreateMappingDto = {
      osirisCode: this.formOsirisCode().trim().toUpperCase(),
      canonicalCode: this.formCanonicalCode().trim().toUpperCase(),
      label: this.formLabel().trim()
    };
    if (!dto.osirisCode || !dto.canonicalCode) {
      this.formError.set('Les deux codes sont requis.');
      return;
    }
    this.formLoading.set(true);
    this.formError.set(null);
    this.svc.create(dto).subscribe({
      next: () => {
        this.formLoading.set(false);
        this.formOpen.set(false);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.formLoading.set(false);
        this.formError.set(err.error?.message || 'Erreur création');
      }
    });
  }

  startEdit(m: OsirisCodeMapping): void {
    this.editId.set(m._id);
    this.editCanonicalCode.set(m.canonicalCode);
    this.editLabel.set(m.label || '');
    this.editError.set(null);
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editError.set(null);
  }

  saveEdit(id: string): void {
    const canonicalCode = this.editCanonicalCode().trim().toUpperCase();
    if (!canonicalCode) {
      this.editError.set('Code admin requis.');
      return;
    }
    this.editLoading.set(true);
    this.editError.set(null);
    this.svc.update(id, {
      canonicalCode,
      label: this.editLabel().trim()
    }).subscribe({
      next: () => {
        this.editLoading.set(false);
        this.editId.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.editLoading.set(false);
        this.editError.set(err.error?.message || 'Erreur mise à jour');
      }
    });
  }

  deactivate(id: string): void {
    const mapping = this.mappings().find((item) => item._id === id) || null;
    if (!mapping) return;
    this.pendingDeactivate.set(mapping);
    this.deactivateModalOpen.set(true);
  }

  remove(id: string): void {
    const mapping = this.mappings().find((item) => item._id === id) || null;
    if (!mapping) return;
    this.pendingDelete.set(mapping);
    this.deleteModalOpen.set(true);
  }

  closeDeactivateModal(): void {
    if (this.deactivateLoading()) return;
    this.deactivateModalOpen.set(false);
    this.pendingDeactivate.set(null);
  }

  confirmDeactivate(): void {
    const mapping = this.pendingDeactivate();
    if (!mapping?._id) return;
    this.deactivateLoading.set(true);
    this.svc.deactivate(mapping._id).subscribe({
      next: () => {
        this.deactivateLoading.set(false);
        this.deactivateModalOpen.set(false);
        this.pendingDeactivate.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deactivateLoading.set(false);
        this.error.set(err.error?.message || 'Erreur désactivation');
      }
    });
  }

  closeDeleteModal(): void {
    if (this.deleteLoading()) return;
    this.deleteModalOpen.set(false);
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const mapping = this.pendingDelete();
    if (!mapping?._id) return;
    this.deleteLoading.set(true);
    this.svc.remove(mapping._id).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.deleteModalOpen.set(false);
        this.pendingDelete.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deleteLoading.set(false);
        this.error.set(err.error?.message || 'Erreur suppression');
      }
    });
  }
}
