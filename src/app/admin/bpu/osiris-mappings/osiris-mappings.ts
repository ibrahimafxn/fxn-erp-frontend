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

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-osiris-mappings',
  imports: [CommonModule, RouterModule, FormsModule],
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
    this.svc.deactivate(id).subscribe({ next: () => this.load() });
  }

  remove(id: string): void {
    if (!confirm('Supprimer ce mapping ? Cette action est irréversible.')) return;
    this.svc.remove(id).subscribe({ next: () => this.load() });
  }
}
