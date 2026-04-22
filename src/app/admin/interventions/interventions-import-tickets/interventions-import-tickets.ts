import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  InterventionImportBatch,
  InterventionImportTicket,
  InterventionService
} from '../../../core/services/intervention.service';
import { apiError } from '../../../core/utils/http-error';
import { formatPersonName } from '../../../core/utils/text-format';

@Component({
  standalone: true,
  selector: 'app-interventions-import-tickets',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './interventions-import-tickets.html',
  styleUrls: ['./interventions-import-tickets.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InterventionsImportTickets implements OnInit {
  private readonly svc = inject(InterventionService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly tickets = signal<InterventionImportTicket[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 20;
  readonly batches = signal<InterventionImportBatch[]>([]);

  readonly actionLoadingId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly editingTicketId = signal<string | null>(null);

  readonly filtersForm = this.fb.nonNullable.group({
    status: ['OPEN'],
    type: [''],
    importBatchId: ['']
  });

  readonly resolveForm = this.fb.nonNullable.group({
    code: [''],
    label: ['']
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly statusOptions = [
    { value: '', label: 'Tous statuts' },
    { value: 'OPEN', label: 'Ouverts' },
    { value: 'RESOLVED', label: 'Résolus' },
    { value: 'IGNORED', label: 'Ignorés' }
  ];

  readonly typeOptions = [
    { value: '', label: 'Tous types' },
    { value: 'unknown_prestation', label: 'Prestation inconnue' },
    { value: 'unknown_technician', label: 'Technicien inconnu' },
    { value: 'ambiguous_intervention', label: 'Intervention ambiguë' },
    { value: 'invalid_row', label: 'Ligne invalide' },
    { value: 'manual_review', label: 'Revue manuelle' }
  ];

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadBatches(), this.loadTickets()]);
  }

  async loadBatches(): Promise<void> {
    try {
      const res = await firstValueFrom(this.svc.listImports({ page: 1, limit: 100 }));
      if (res.success) this.batches.set(res.data.items ?? []);
    } catch {
      /* non bloquant */
    }
  }

  async loadTickets(resetPage = false): Promise<void> {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    this.error.set(null);
    try {
      const filters = this.filtersForm.getRawValue();
      const res = await firstValueFrom(this.svc.listImportTickets({
        page: this.page(),
        limit: this.limit,
        status: filters.status || undefined,
        type: filters.type || undefined,
        importBatchId: filters.importBatchId || undefined
      }));
      if (!res.success) throw new Error('Erreur chargement tickets');
      this.tickets.set(res.data.items ?? []);
      this.total.set(res.data.total ?? 0);
    } catch (err: unknown) {
      this.error.set(apiError(err, 'Erreur lors du chargement des tickets'));
    } finally {
      this.loading.set(false);
    }
  }

  async onFiltersChange(): Promise<void> {
    await this.loadTickets(true);
  }

  async prevPage(): Promise<void> {
    if (!this.canPrev()) return;
    this.page.update(value => value - 1);
    await this.loadTickets();
  }

  async nextPage(): Promise<void> {
    if (!this.canNext()) return;
    this.page.update(value => value + 1);
    await this.loadTickets();
  }

  openManualResolve(ticket: InterventionImportTicket): void {
    this.actionError.set(null);
    this.editingTicketId.set(ticket._id);
    this.resolveForm.setValue({
      code: ticket.correctedCode || '',
      label: ticket.correctedLabel || ''
    });
  }

  cancelManualResolve(): void {
    this.editingTicketId.set(null);
    this.resolveForm.reset({ code: '', label: '' });
  }

  async resolveManual(ticket: InterventionImportTicket): Promise<void> {
    const payload = this.resolveForm.getRawValue();
    if (!payload.code.trim()) {
      this.actionError.set('Le code prestation est requis.');
      return;
    }

    this.actionLoadingId.set(ticket._id);
    this.actionError.set(null);
    try {
      const res = await firstValueFrom(this.svc.resolveImportTicket(ticket._id, {
        code: payload.code.trim().toUpperCase(),
        label: payload.label.trim() || undefined
      }));
      if (!res.success) throw new Error('Erreur résolution ticket');
      this.cancelManualResolve();
      await this.loadTickets();
    } catch (err: unknown) {
      this.actionError.set(apiError(err, 'Erreur lors de la résolution manuelle'));
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  async resolveAuto(ticket: InterventionImportTicket): Promise<void> {
    this.actionLoadingId.set(ticket._id);
    this.actionError.set(null);
    try {
      const res = await firstValueFrom(this.svc.resolveImportTicketAuto(ticket._id));
      if (!res.success) throw new Error('Erreur résolution automatique');
      if (this.editingTicketId() === ticket._id) this.cancelManualResolve();
      await this.loadTickets();
    } catch (err: unknown) {
      this.actionError.set(apiError(err, 'Erreur lors de la résolution automatique'));
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  isOpen(ticket: InterventionImportTicket): boolean {
    return (ticket.status || 'OPEN') === 'OPEN';
  }

  canManualResolve(ticket: InterventionImportTicket): boolean {
    if (!this.isOpen(ticket)) return false;
    return ['unknown_prestation', 'manual_review'].includes(ticket.type || '');
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  ticketTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      unknown_prestation: 'Prestation inconnue',
      unknown_technician: 'Technicien inconnu',
      ambiguous_intervention: 'Intervention ambiguë',
      invalid_row: 'Ligne invalide',
      manual_review: 'Revue manuelle'
    };
    return labels[type || ''] ?? (type || '—');
  }

  statusLabel(status?: string): string {
    const labels: Record<string, string> = {
      OPEN: 'Ouvert',
      RESOLVED: 'Résolu',
      IGNORED: 'Ignoré'
    };
    return labels[status || ''] ?? (status || '—');
  }

  statusClass(status?: string): string {
    if (status === 'RESOLVED') return 'status-ok';
    if (status === 'IGNORED') return 'status-neutral';
    return 'status-warn';
  }

  techLabel(ticket: InterventionImportTicket): string {
    const first = ticket.techFirstName || '';
    const last = ticket.techLastName || '';
    return formatPersonName(first, last) || ticket.techFull || '—';
  }

  batchLabel(ticket: InterventionImportTicket): string {
    return ticket.importBatchId?.originalName || ticket.importBatchId?._id || '—';
  }
}
