import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, ElementRef, ViewChild, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  InterventionService,
  InterventionImportBatch,
  ImportPipelineResult,
  ImportPreviewSummary,
  ImportCommitResult,
  ImportRowItem,
  ImportBatchDetail
} from '../../../core/services/intervention.service';
import { formatPersonName } from '../../../core/utils/text-format';
import { downloadBlob } from '../../../core/utils/download';
import { apiError } from '../../../core/utils/http-error';

type Step = 'upload' | 'preview' | 'commit' | 'result';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-interventions-import',
  imports: [CommonModule, RouterModule],
  templateUrl: './interventions-import.html',
  styleUrls: ['./interventions-import.scss']
})
export class InterventionsImport {
  private svc = inject(InterventionService);

  @ViewChild('csvInput') private csvInput?: ElementRef<HTMLInputElement>;

  // ── État assistant ────────────────────────────────────────────────────────────
  readonly step = signal<Step>('upload');
  readonly selectedFile = signal<File | null>(null);
  readonly analyzing = signal(false);
  readonly committing = signal(false);
  readonly error = signal<string | null>(null);

  readonly batchId = signal<string | null>(null);
  readonly batchDetail = signal<ImportBatchDetail | null>(null);
  readonly preview = signal<ImportPreviewSummary | null>(null);
  readonly previewStatus = signal<string>('');
  readonly commitResult = signal<ImportCommitResult | null>(null);

  // ── Conflits de période ───────────────────────────────────────────────────────
  readonly conflictOpen = signal(false);
  readonly conflictInfo = signal<{ periodLabel?: string; existingName?: string } | null>(null);

  // ── Historique ────────────────────────────────────────────────────────────────
  readonly importsLoading = signal(false);
  readonly importBatches = signal<InterventionImportBatch[]>([]);
  readonly importsError = signal<string | null>(null);

  // ── Lignes bloquées ───────────────────────────────────────────────────────────
  readonly blockedRows = signal<ImportRowItem[]>([]);
  readonly blockedLoading = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────────
  readonly latestImport = computed(() => this.importBatches()[0] || null);
  readonly canCommit = computed(() =>
    !!this.batchId() && ['ready', 'blocked'].includes(this.previewStatus()) && !this.committing()
  );
  readonly referentialGroups = computed(() => {
    const created = this.preview()?.referentials.created ?? [];
    const groups = new Map<string, { group: string; count: number; labels: string[] }>();
    for (const item of created) {
      const key = item.group || 'autre';
      const current = groups.get(key) ?? { group: key, count: 0, labels: [] };
      current.count += 1;
      if (current.labels.length < 6) current.labels.push(item.label);
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => a.group.localeCompare(b.group, 'fr'));
  });

  readonly decisionTotal = computed(() => {
    const p = this.preview();
    if (!p) return 0;
    return (p.decisions.create ?? 0) + (p.decisions.version ?? 0) + (p.decisions.skip ?? 0) + (p.decisions.ticket ?? 0);
  });

  ngOnInit(): void {
    this.loadHistory();
  }

  // ── Sélection fichier ─────────────────────────────────────────────────────────
  onFileClick(): void {
    if (this.csvInput?.nativeElement) this.csvInput.nativeElement.value = '';
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.error.set(null);
  }

  // ── Phase 1 : analyser ────────────────────────────────────────────────────────
  async analyze(overwrite = false): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.analyzing.set(true);
    this.error.set(null);
    this.preview.set(null);
    this.batchId.set(null);
    this.blockedRows.set([]);

    try {
      const res = await firstValueFrom(this.svc.analyzeImport(file, overwrite));
      if (!res.success) throw new Error('Analyse échouée');
      const result: ImportPipelineResult = res.data;
      this.batchId.set(result.batchId);
      this.preview.set(result.preview);
      this.previewStatus.set(result.status);
      await this.loadBatchDetail(result.batchId);
      this.step.set('preview');

      // Charger les lignes bloquées si besoin
      if (result.preview.blockedLines > 0) this.loadBlockedRows(result.batchId);
    } catch (err: unknown) {
      const e = err as { status?: number; error?: { data?: { periodLabel?: string; existingImport?: { originalName?: string } } }; message?: string };
      if (e?.status === 409 || (e as { error?: { message?: string } })?.error?.['message']?.includes('période')) {
        this.conflictInfo.set({
          periodLabel: e.error?.data?.periodLabel,
          existingName: e.error?.data?.existingImport?.originalName
        });
        this.conflictOpen.set(true);
      } else {
        this.error.set(apiError(err, 'Erreur lors de l\'analyse du fichier'));
      }
    } finally {
      this.analyzing.set(false);
    }
  }

  confirmOverwrite(): void {
    this.conflictOpen.set(false);
    this.conflictInfo.set(null);
    this.analyze(true);
  }

  cancelOverwrite(): void {
    this.conflictOpen.set(false);
    this.conflictInfo.set(null);
  }

  // ── Phase 2 → 3 : commit ─────────────────────────────────────────────────────
  async commit(): Promise<void> {
    const id = this.batchId();
    if (!id) return;
    this.committing.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.svc.commitImport(id));
      if (!res.success) throw new Error('Commit échoué');
      this.commitResult.set(res.data);
      this.step.set('result');
      this.loadHistory();
    } catch (err: unknown) {
      this.error.set(apiError(err, 'Erreur lors du commit'));
    } finally {
      this.committing.set(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────
  reset(): void {
    this.step.set('upload');
    this.selectedFile.set(null);
    this.batchId.set(null);
    this.batchDetail.set(null);
    this.preview.set(null);
    this.previewStatus.set('');
    this.commitResult.set(null);
    this.error.set(null);
    this.blockedRows.set([]);
    if (this.csvInput?.nativeElement) this.csvInput.nativeElement.value = '';
  }

  // ── Historique ────────────────────────────────────────────────────────────────
  async loadHistory(): Promise<void> {
    this.importsLoading.set(true);
    try {
      const res = await firstValueFrom(this.svc.listImports({ page: 1, limit: 10 }));
      if (res.success) this.importBatches.set(res.data.items ?? []);
    } catch {
      this.importsError.set('Erreur chargement historique');
    } finally {
      this.importsLoading.set(false);
    }
  }

  async downloadBatch(id: string): Promise<void> {
    try {
      const blob = await firstValueFrom(this.svc.downloadImport(id));
      downloadBlob(blob, `osiris-import-${id}.csv`);
    } catch {
      /* ignore */
    }
  }

  // ── Lignes bloquées ───────────────────────────────────────────────────────────
  async loadBlockedRows(batchId: string): Promise<void> {
    this.blockedLoading.set(true);
    try {
      const res = await firstValueFrom(this.svc.listImportItems(batchId, { decision: 'ticket', limit: 20 }));
      if (res.success) this.blockedRows.set(res.data.items);
    } catch {
      /* non-bloquant */
    } finally {
      this.blockedLoading.set(false);
    }
  }

  async loadBatchDetail(batchId: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.svc.getImportPreview(batchId));
      if (!res.success) return;
      this.batchDetail.set(res.data);
      if (res.data.previewSummary) this.preview.set(res.data.previewSummary);
      this.previewStatus.set(res.data.status ?? this.previewStatus());
    } catch {
      this.batchDetail.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(dt);
  }

  batchImporter(batch: InterventionImportBatch): string {
    if (!batch.importedBy) return '—';
    return formatPersonName(batch.importedBy.firstName ?? '', batch.importedBy.lastName ?? '');
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      uploaded: 'Uploadé', analyzing: 'Analyse…', ready: 'Prêt',
      blocked: 'Bloqué', committed: 'Commité', failed: 'Échoué',
      COMPLETED: 'Terminé', PROCESSING: 'En cours', FAILED: 'Échoué'
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    if (['committed', 'COMPLETED'].includes(status)) return 'status-ok';
    if (['failed', 'FAILED', 'blocked'].includes(status)) return 'status-err';
    if (['analyzing', 'PROCESSING'].includes(status)) return 'status-warn';
    return 'status-neutral';
  }

  pct(value: number): string {
    const total = this.decisionTotal();
    if (!total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  }
}
