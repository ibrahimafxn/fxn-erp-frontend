import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { InterventionService, InterventionImportBatch, ImportBatchDetail, ImportPreviewSummary } from '../../../core/services/intervention.service';
import { formatPersonName } from '../../../core/utils/text-format';
import { downloadBlob } from '../../../core/utils/download';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-interventions-import-history',
  imports: [CommonModule, RouterModule],
  templateUrl: './interventions-import-history.html',
  styleUrls: ['./interventions-import-history.scss']
})
export class InterventionsImportHistory implements OnInit {
  private svc = inject(InterventionService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly batches = signal<InterventionImportBatch[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 15;

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly expandedId = signal<string | null>(null);
  readonly expandedData = signal<ImportBatchDetail | null>(null);
  readonly expandedLoading = signal(false);

  ngOnInit(): void { this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.svc.listImports({ page: this.page(), limit: this.limit }));
      if (res.success) {
        this.batches.set(res.data.items ?? []);
        this.total.set(res.data.total ?? 0);
      }
    } catch {
      this.error.set('Erreur lors du chargement de l\'historique');
    } finally {
      this.loading.set(false);
    }
  }

  prevPage(): void { if (this.canPrev()) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.canNext()) { this.page.update(p => p + 1); this.load(); } }

  async toggleExpand(batch: InterventionImportBatch): Promise<void> {
    const id = batch._id;
    if (this.expandedId() === id) { this.expandedId.set(null); this.expandedData.set(null); return; }
    this.expandedId.set(id);
    this.expandedData.set(null);
    this.expandedLoading.set(true);
    try {
      const res = await firstValueFrom(this.svc.getImportPreview(id));
      if (res.success) this.expandedData.set(res.data);
    } catch { /* ignore */ } finally {
      this.expandedLoading.set(false);
    }
  }

  async download(id: string, name?: string): Promise<void> {
    try {
      const blob = await firstValueFrom(this.svc.downloadImport(id));
      downloadBlob(blob, name || `osiris-${id}.csv`);
    } catch { /* ignore */ }
  }

  importer(batch: InterventionImportBatch): string {
    if (!batch.importedBy) return '—';
    return formatPersonName(batch.importedBy.firstName ?? '', batch.importedBy.lastName ?? '');
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(dt);
  }

  formatPeriod(batch: InterventionImportBatch): string {
    const s = batch.periodStart ? new Date(batch.periodStart) : null;
    const e = batch.periodEnd   ? new Date(batch.periodEnd)   : null;
    if (!s) return '—';
    const fmt = (d: Date) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(d);
    return e && s.toDateString() !== e.toDateString() ? `${fmt(s)} → ${fmt(e)}` : fmt(s);
  }

  statusLabel(status: string): string {
    const m: Record<string, string> = { uploaded: 'Uploadé', analyzing: 'Analyse…', ready: 'Prêt', blocked: 'Bloqué', committed: 'Commité', failed: 'Échoué', COMPLETED: 'Terminé', PROCESSING: 'En cours', FAILED: 'Échoué' };
    return m[status] ?? status;
  }

  statusClass(status: string): string {
    if (['committed', 'COMPLETED'].includes(status)) return 'status-ok';
    if (['failed', 'FAILED', 'blocked'].includes(status)) return 'status-err';
    if (['analyzing', 'PROCESSING'].includes(status)) return 'status-warn';
    return 'status-neutral';
  }

  preview(data: ImportBatchDetail): ImportPreviewSummary | null {
    return data.previewSummary ?? null;
  }
}
