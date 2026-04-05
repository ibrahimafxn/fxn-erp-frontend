import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Component, ElementRef, ViewChild, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import {
  InterventionService,
  InterventionImportBatch,
  InterventionImportTicket,
  InterventionImportCategory,
  InterventionImportCategoryItem,
  BpuAnalysisReport
} from '../../../core/services/intervention.service';
import { OsirisMappingService } from '../../../core/services/osiris-mapping.service';
import { formatPersonName } from '../../../core/utils/text-format';
import { INTERVENTION_PRESTATION_FIELDS } from '../../../core/constant/intervention-prestations';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-interventions-import',
  imports: [CommonModule, RouterModule, FormsModule, ConfirmDeleteModal],
  templateUrl: './interventions-import.html',
  styleUrls: ['./interventions-import.scss']
})
export class InterventionsImport {
  private svc = inject(InterventionService);
  private mappingSvc = inject(OsirisMappingService);
  private readonly emptyCategoryState = { items: [], total: 0, page: 1, loading: false, error: null } as const;

  @ViewChild('csvInput') private csvInput?: ElementRef<HTMLInputElement>;

  selectedFile: File | null = null;
  readonly importLoading = signal(false);
  readonly importResult = signal<string | null>(null);
  readonly importError = signal<string | null>(null);
  readonly overwriteOpen = signal(false);
  readonly overwriteInfo = signal<{ periodLabel?: string; existingName?: string; createdAt?: string } | null>(null);

  readonly importsLoading = signal(false);
  readonly importsError = signal<string | null>(null);
  readonly importBatches = signal<InterventionImportBatch[]>([]);
  readonly ticketsLoading = signal(false);
  readonly ticketsError = signal<string | null>(null);
  readonly importTickets = signal<InterventionImportTicket[]>([]);
  readonly importCategoryState = signal<Record<InterventionImportCategory, {
    items: InterventionImportCategoryItem[];
    total: number;
    page: number;
    loading: boolean;
    error: string | null;
  }>>({
    success: { items: [], total: 0, page: 1, loading: false, error: null },
    failure: { items: [], total: 0, page: 1, loading: false, error: null },
    versioned: { items: [], total: 0, page: 1, loading: false, error: null },
    rejected: { items: [], total: 0, page: 1, loading: false, error: null },
    tickets: { items: [], total: 0, page: 1, loading: false, error: null }
  });
  private readonly CATEGORY_LIMIT = 20;
  readonly categoryKeys: InterventionImportCategory[] = ['success', 'failure', 'versioned', 'rejected', 'tickets'];
  readonly lastImportBatchId = signal<string | null>(null);
  readonly bpuAnalysis = signal<BpuAnalysisReport | null>(null);
  readonly bpuAnalysisLoading = signal(false);
  readonly bpuAnalysisPending = signal(false);
  private bpuPollTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Formulaire inline de mapping code OSIRIS → code admin ─────────────────
  readonly mappingFormOpen = signal<string | null>(null); // osirisCode en cours de mapping
  readonly mappingFormCanonical = signal('');
  readonly mappingFormLabel = signal('');
  readonly mappingFormLoading = signal(false);
  readonly mappingFormError = signal<string | null>(null);
  readonly mappingFormSuccess = signal<string | null>(null);
  readonly ticketEditOpen = signal(false);
  readonly ticketEditSaving = signal(false);
  readonly ticketEditError = signal<string | null>(null);
  readonly ticketEditTarget = signal<InterventionImportTicket | null>(null);
  readonly ticketEditCode = signal('');

  readonly latestImport = computed(() => this.importBatches()[0] || null);
  readonly latestImportNotice = computed(() => this.formatImportNotice(this.latestImport(), false));
  readonly todayImportNotice = computed(() => this.formatImportNotice(this.latestImport(), true));
  readonly prestationRules = INTERVENTION_PRESTATION_FIELDS;
  private readonly REQUIRED_COLUMNS = ['Liste des prestations réalisées', 'Articles'] as const;
  private readonly OPTIONAL_COLUMNS = ['Statut', 'Type', 'Type operation', 'Commentaires technicien', 'Marque'] as const;
  private readonly PREVIEW_LINE_LIMIT = 40;
  readonly previewColumns = signal<{ name: string; present: boolean }[]>([]);
  readonly previewRows = signal(0);
  readonly previewUnknownList = signal<string[]>([]);
  readonly previewRecognizedList = signal<string[]>([]);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly categoryLabels: Record<InterventionImportCategory, string> = {
    success: 'Succès',
    failure: 'Échec',
    versioned: 'Versionnées',
    rejected: 'Rejetées',
    tickets: 'Tickets'
  };
  readonly Math = Math;

  categoryState(category: InterventionImportCategory) {
    return this.importCategoryState()[category] ?? this.emptyCategoryState;
  }

  private formatImportNotice(batch: InterventionImportBatch | null, todayOnly: boolean): string | null {
    if (!batch) return null;
    if (todayOnly && !batch.isToday) return null;
    const date = new Date(batch.createdAt || batch.importedAt || '');
    if (Number.isNaN(date.getTime())) return null;
    const formattedTime = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    const importerName = batch.importedBy
      ? formatPersonName(batch.importedBy.firstName ?? '', batch.importedBy.lastName ?? '')
      : '—';
    if (batch.isToday) {
      return `Import du jour réalisé par ${importerName} à ${formattedTime}`;
    }
    if (todayOnly) {
      return null;
    }
    const formattedDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
    return `Dernier import : ${formattedDate} à ${formattedTime} par ${importerName}`;
  }

  constructor() {
    this.loadImports();
  }

  onFileClick(): void {
    const input = this.csvInput?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.selectedFile = null;
    this.importError.set(null);
    this.importResult.set(null);
    this.resetPreview();
  }

  onFileChange(event: Event): void {
    const el = event.target instanceof HTMLInputElement ? event.target : null;
    this.selectedFile = el?.files?.[0] ?? null;
    this.importError.set(null);
    this.importResult.set(null);
    if (this.selectedFile) {
      this.previewCsv(this.selectedFile);
    } else {
      this.resetPreview();
    }
  }

  importCsv(overwrite = false): void {
    if (!this.selectedFile) {
      this.importError.set('Sélectionne un fichier CSV.');
      return;
    }

    this.importLoading.set(true);
    this.importError.set(null);
    this.importResult.set(null);

    this.svc.importCsv(this.selectedFile, { overwrite }).subscribe({
      next: (res) => {
        this.importLoading.set(false);
        if (res.success) {
          const data = res.data as {
            total?: number;
            created?: number;
            updated?: number;
            versioned?: number;
            rejected?: number;
            tickets?: number;
            success?: number;
            failure?: number;
            importBatchId?: string;
          } | undefined;
          const total = data?.total ?? 0;
          const created = data?.created ?? 0;
          const versioned = data?.versioned ?? (data?.updated ?? 0);
          const rejected = data?.rejected ?? 0;
          const tickets = data?.tickets ?? 0;
          const success = data?.success ?? 0;
          const failure = data?.failure ?? 0;
          if (total > 0) {
            this.importResult.set(
              `Import terminé. Total: ${total}. Succès: ${success}. Échec: ${failure}. Créées: ${created}. Versionnées: ${versioned}. Rejetées: ${rejected}. Tickets: ${tickets}.`
            );
          } else {
            this.importResult.set('Import terminé.');
          }
          if (data?.importBatchId) {
            const batchId = String(data.importBatchId);
            this.lastImportBatchId.set(batchId);
            this.loadImportCategories(batchId);
            this.pollBpuAnalysis(batchId);
          }
          this.resetFileInput();
          this.loadImports();
          this.loadTickets();
          return;
        }
        this.importError.set(res.message || 'Erreur import CSV');
        this.resetFileInput();
      },
      error: (err: HttpErrorResponse) => {
        this.importLoading.set(false);
        if (err.status === 409 && err.error?.data) {
          const info = err.error.data as { periodLabel?: string; existingImport?: { originalName?: string; createdAt?: string } };
          this.overwriteInfo.set({
            periodLabel: info.periodLabel,
            existingName: info.existingImport?.originalName,
            createdAt: info.existingImport?.createdAt
          });
          this.overwriteOpen.set(true);
          this.importError.set(this.apiError(err, 'Import deja existant pour la periode.'));
          return;
        }
        this.importError.set(this.apiError(err, 'Erreur import CSV'));
        this.resetFileInput();
      }
    });
  }

  confirmOverwrite(): void {
    this.overwriteOpen.set(false);
    this.importCsv(true);
  }

  cancelOverwrite(): void {
    this.overwriteOpen.set(false);
  }

  downloadLatestImport(): void {
    const batch = this.latestImport();
    const id = batch?._id;
    if (!id) return;
    const filename = (batch?.originalName || batch?.storedName || 'import.csv').trim();
    this.svc.downloadImport(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.importsError.set(this.apiError(err, 'Erreur téléchargement CSV'));
      }
    });
  }

  loadImports(): void {
    this.importsLoading.set(true);
    this.importsError.set(null);
    this.svc.listImports({ page: 1, limit: 5 }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.importsError.set('Erreur chargement imports');
          this.importsLoading.set(false);
          return;
        }
        const items = res.data.items || [];
        this.importBatches.set(items);
        this.importsLoading.set(false);
        const latestId = items[0]?._id;
        if (latestId) {
          this.lastImportBatchId.set(latestId);
          this.loadImportCategories(latestId);
          this.loadBpuAnalysis(latestId);
        }
        this.loadTickets(latestId);
      },
      error: (err) => {
        this.importsLoading.set(false);
        this.importsError.set(this.apiError(err, 'Erreur chargement imports'));
      }
    });
  }

  loadTickets(importBatchId?: string): void {
    this.ticketsLoading.set(true);
    this.ticketsError.set(null);
    const query: { page: number; limit: number; status: string; importBatchId?: string } = {
      page: 1,
      limit: 20,
      status: 'OPEN'
    };
    if (importBatchId) query.importBatchId = importBatchId;
    this.svc.listImportTickets(query).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.ticketsError.set('Erreur chargement tickets');
          this.ticketsLoading.set(false);
          return;
        }
        this.importTickets.set(res.data.items || []);
        this.ticketsLoading.set(false);
      },
      error: (err) => {
        this.ticketsLoading.set(false);
        this.ticketsError.set(this.apiError(err, 'Erreur chargement tickets'));
      }
    });
  }

  loadImportCategories(importBatchId?: string): void {
    const batchId = importBatchId || this.lastImportBatchId();
    if (!batchId) return;
    this.categoryKeys.forEach((category) => this.loadImportCategory(category, batchId, 1));
  }

  loadImportCategory(category: InterventionImportCategory, importBatchId: string, page: number): void {
    const state = this.importCategoryState();
    const current = state[category];
    this.importCategoryState.set({
      ...state,
      [category]: { ...current, loading: true, error: null, page }
    });
    this.svc.listImportCategory({
      category,
      importBatchId,
      page,
      limit: this.CATEGORY_LIMIT
    }).subscribe({
      next: (res) => {
        const data = res.data;
        this.importCategoryState.set({
          ...this.importCategoryState(),
          [category]: {
            items: data.items || [],
            total: data.total || 0,
            page: data.page || page,
            loading: false,
            error: null
          }
        });
      },
      error: (err: HttpErrorResponse) => {
        const message = this.apiError(err, 'Erreur chargement catégorie');
        this.importCategoryState.set({
          ...this.importCategoryState(),
          [category]: {
            ...this.importCategoryState()[category],
            loading: false,
            error: message
          }
        });
      }
    });
  }

  prevCategoryPage(category: InterventionImportCategory): void {
    const state = this.categoryState(category);
    if (state.page <= 1) return;
    const batchId = this.lastImportBatchId();
    if (!batchId) return;
    this.loadImportCategory(category, batchId, state.page - 1);
  }

  nextCategoryPage(category: InterventionImportCategory): void {
    const state = this.categoryState(category);
    const totalPages = Math.max(1, Math.ceil((state.total || 0) / this.CATEGORY_LIMIT));
    if (state.page >= totalPages) return;
    const batchId = this.lastImportBatchId();
    if (!batchId) return;
    this.loadImportCategory(category, batchId, state.page + 1);
  }

  categoryPageRange(category: InterventionImportCategory): string {
    const state = this.categoryState(category);
    if (!state.total) return '0';
    const start = (state.page - 1) * this.CATEGORY_LIMIT + 1;
    const end = Math.min(state.page * this.CATEGORY_LIMIT, state.total);
    return `${start}–${end} / ${state.total}`;
  }

  categoryTotalPages(category: InterventionImportCategory): number {
    const state = this.categoryState(category);
    return Math.max(1, Math.ceil((state.total || 0) / this.CATEGORY_LIMIT));
  }

  ticketTechLabel(ticket: InterventionImportTicket): string {
    const first = ticket.techFirstName || '';
    const last = ticket.techLastName || '';
    const combined = `${first} ${last}`.trim();
    return combined || ticket.techFull || '—';
  }

  openTicketEdit(ticket: InterventionImportTicket): void {
    this.ticketEditTarget.set(ticket);
    this.ticketEditCode.set('');
    this.ticketEditError.set(null);
    this.ticketEditOpen.set(true);
  }

  closeTicketEdit(): void {
    this.ticketEditOpen.set(false);
    this.ticketEditTarget.set(null);
    this.ticketEditSaving.set(false);
    this.ticketEditError.set(null);
    this.ticketEditCode.set('');
  }

  saveTicketEdit(): void {
    const ticket = this.ticketEditTarget();
    const code = this.ticketEditCode().trim().toUpperCase();
    if (!ticket?._id || !code) {
      this.ticketEditError.set('Sélectionne une prestation.');
      return;
    }
    const label = this.prestationRules.find((p) => p.code === code)?.label || '';
    this.ticketEditSaving.set(true);
    this.ticketEditError.set(null);
    this.svc.resolveImportTicket(ticket._id, { code, label }).subscribe({
      next: () => {
        this.ticketEditSaving.set(false);
        this.closeTicketEdit();
        this.loadTickets(this.lastImportBatchId() || undefined);
        if (this.lastImportBatchId()) this.loadImportCategory('tickets', this.lastImportBatchId()!, 1);
      },
      error: (err: HttpErrorResponse) => {
        this.ticketEditSaving.set(false);
        this.ticketEditError.set(this.apiError(err, 'Erreur correction ticket'));
      }
    });
  }

  autoResolveTicket(ticket: InterventionImportTicket): void {
    if (!ticket?._id) return;
    this.svc.resolveImportTicketAuto(ticket._id).subscribe({
      next: () => {
        this.loadTickets(this.lastImportBatchId() || undefined);
        if (this.lastImportBatchId()) this.loadImportCategory('tickets', this.lastImportBatchId()!, 1);
      },
      error: (err: HttpErrorResponse) => {
        this.importsError.set(this.apiError(err, 'Erreur validation automatique'));
      }
    });
  }

  loadBpuAnalysis(batchId: string): void {
    this.bpuAnalysisLoading.set(true);
    this.bpuAnalysis.set(null);
    this.bpuAnalysisPending.set(false);
    this.svc.getBpuAnalysis(batchId).subscribe({
      next: (res) => {
        this.bpuAnalysisLoading.set(false);
        if (res.data) {
          this.bpuAnalysis.set(res.data);
          this.bpuAnalysisPending.set(false);
        } else {
          this.bpuAnalysisPending.set(true);
        }
      },
      error: () => {
        this.bpuAnalysisLoading.set(false);
      }
    });
  }

  pollBpuAnalysis(batchId: string): void {
    this.bpuAnalysis.set(null);
    this.bpuAnalysisPending.set(true);
    if (this.bpuPollTimer) clearTimeout(this.bpuPollTimer);
    const attempt = (tries: number) => {
      this.bpuPollTimer = setTimeout(() => {
        this.svc.getBpuAnalysis(batchId).subscribe({
          next: (res) => {
            if (res.data) {
              this.bpuAnalysis.set(res.data);
              this.bpuAnalysisPending.set(false);
            } else if (tries > 0) {
              attempt(tries - 1);
            } else {
              this.bpuAnalysisPending.set(false);
            }
          },
          error: () => { this.bpuAnalysisPending.set(false); }
        });
      }, 2500);
    };
    attempt(6); // ~15s max
  }

  bpuUnknownEntries(): { code: string; count: number; suggestions: { code: string; label: string; distance: number }[]; rawExamples: string[] }[] {
    const report = this.bpuAnalysis();
    if (!report?.unknownCodes) return [];
    return Object.entries(report.unknownCodes)
      .map(([code, val]) => ({ code, ...val }))
      .sort((a, b) => b.count - a.count);
  }

  bpuMatchRateClass(rate: number): string {
    if (rate >= 90) return 'rate-high';
    if (rate >= 60) return 'rate-medium';
    return 'rate-low';
  }

  openMappingForm(osirisCode: string): void {
    this.mappingFormOpen.set(osirisCode);
    this.mappingFormCanonical.set('');
    this.mappingFormLabel.set('');
    this.mappingFormError.set(null);
    this.mappingFormSuccess.set(null);
  }

  closeMappingForm(): void {
    this.mappingFormOpen.set(null);
    this.mappingFormError.set(null);
    this.mappingFormSuccess.set(null);
  }

  saveMappingForm(): void {
    const osirisCode = this.mappingFormOpen();
    const canonicalCode = this.mappingFormCanonical().trim().toUpperCase();
    if (!osirisCode || !canonicalCode) {
      this.mappingFormError.set('Le code prestation admin est requis.');
      return;
    }
    this.mappingFormLoading.set(true);
    this.mappingFormError.set(null);
    this.mappingSvc.create({
      osirisCode,
      canonicalCode,
      label: this.mappingFormLabel().trim()
    }).subscribe({
      next: () => {
        this.mappingFormLoading.set(false);
        this.mappingFormSuccess.set(`"${osirisCode}" → "${canonicalCode}" enregistré.`);
        this.mappingFormOpen.set(null);
        // Relancer l'analyse sur le batch courant pour refléter le nouveau mapping
        const batchId = this.lastImportBatchId();
        if (batchId) this.loadBpuAnalysis(batchId);
      },
      error: (err: HttpErrorResponse) => {
        this.mappingFormLoading.set(false);
        this.mappingFormError.set(err.error?.message || 'Erreur lors de la création du mapping.');
      }
    });
  }

  private resetFileInput(): void {
    const input = this.csvInput?.nativeElement;
    if (input) input.value = '';
    this.selectedFile = null;
    this.resetPreview();
  }

  private previewCsv(file: File): void {
    this.resetPreview();
    this.previewLoading.set(true);
    this.previewError.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      this.previewLoading.set(false);
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (!content) {
        this.previewError.set('Le fichier ne peut pas être lu.');
        return;
      }
      this.handlePreviewText(content);
    };
    reader.onerror = () => {
      this.previewLoading.set(false);
      this.previewError.set('Impossible de lire le fichier pour analyse.');
    };
    reader.readAsText(file);
  }

  private handlePreviewText(text: string): void {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!lines.length) {
      this.previewError.set('Le fichier est vide ou mal formé.');
      return;
    }
    const header = this.parseCsvLine(lines[0]);
    if (!header.length) {
      this.previewError.set('Impossible de détecter l’en-tête du CSV.');
      return;
    }
    const normalizedHeader = header.map((value) => this.normalizeHeaderKey(value));
    const columns = [...this.REQUIRED_COLUMNS, ...this.OPTIONAL_COLUMNS].map((name) => ({
      name,
      present: normalizedHeader.includes(this.normalizeHeaderKey(name))
    }));
    this.previewColumns.set(columns);

    const indices = {
      articles: this.findHeaderIndex(normalizedHeader, ['articles', 'article', 'prestations', 'codes']),
      prestations: this.findHeaderIndex(normalizedHeader, [
        'listedesprestationsrealisees',
        'listeprestationsrealisees',
        'prestationsrealisees'
      ]),
      statut: this.findHeaderIndex(normalizedHeader, ['statut', 'status']),
      type: this.findHeaderIndex(normalizedHeader, ['type', 'typeintervention', 'prestation']),
      typeOperation: this.findHeaderIndex(normalizedHeader, ['typeoperation']),
      commentaires: this.findHeaderIndex(normalizedHeader, [
        'commentairestechnicien',
        'commentairetechnicien',
        'commentaireinter',
        'commentairesinter',
        'commentaires',
        'commentaire'
      ]),
      marque: this.findHeaderIndex(normalizedHeader, ['marque'])
    };
    if (indices.articles < 0 && indices.prestations < 0) {
      this.previewError.set('Les colonnes Articles ou Liste des prestations ne sont pas présentes.');
      return;
    }

    const sampleLines = lines.slice(1, 1 + this.PREVIEW_LINE_LIMIT);
    const codeLookup = new Set(INTERVENTION_PRESTATION_FIELDS.map((field) => field.code.toUpperCase()));
    const recognizedSet = new Set<string>();
    const unknownSet = new Set<string>();
    let scanned = 0;

    for (const rawLine of sampleLines) {
      if (!rawLine.trim()) continue;
      const row = this.parseCsvLine(rawLine);
      const codes = this.resolvePreviewCodes(row, indices);
      if (!codes.length) continue;
      scanned++;
      for (const code of codes) {
        if (codeLookup.has(code)) {
          recognizedSet.add(code);
        } else {
          unknownSet.add(code);
        }
      }
    }

    this.previewRows.set(scanned);
    this.previewUnknownList.set([...unknownSet].slice(0, 8));
    this.previewRecognizedList.set([...recognizedSet].slice(0, 8));
    this.previewError.set(null);
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === ';' && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current);
    return result;
  }

  private extractPrestationCodes(value: string): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.split(/\s+/)[0])
      .map((entry) => entry.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase())
      .filter(Boolean);
  }

  private resolvePreviewCodes(
    row: string[],
    indices: {
      articles: number;
      prestations: number;
      statut: number;
      type: number;
      typeOperation: number;
      commentaires: number;
      marque: number;
    }
  ): string[] {
    const codes = new Set<string>();
    const articlesValue = indices.articles >= 0 ? row[indices.articles] ?? '' : '';
    const prestationsValue = indices.prestations >= 0 ? row[indices.prestations] ?? '' : '';
    const statutValue = indices.statut >= 0 ? row[indices.statut] ?? '' : '';
    const typeValue = indices.type >= 0 ? row[indices.type] ?? '' : '';
    const typeOperationValue = indices.typeOperation >= 0 ? row[indices.typeOperation] ?? '' : '';
    const commentairesValue = indices.commentaires >= 0 ? row[indices.commentaires] ?? '' : '';
    const marqueValue = indices.marque >= 0 ? row[indices.marque] ?? '' : '';

    for (const code of this.extractPrestationCodes(articlesValue)) {
      codes.add(code);
    }
    for (const code of this.extractPrestationCodes(prestationsValue)) {
      codes.add(code);
    }

    const statusNormalized = this.normalizeToken(statutValue);
    if (indices.statut >= 0 && !(statusNormalized.includes('CLOTURE') && statusNormalized.includes('TERMINEE'))) {
      return [];
    }

    const typeNormalized = this.normalizeToken(typeValue).replace(/-/g, ' ').trim();
    const operationNormalized = this.normalizeToken(typeOperationValue);
    const articlesNormalized = this.normalizeToken(articlesValue);
    const commentairesNormalized = this.normalizeToken(commentairesValue);
    const prestationsNormalized = this.normalizeToken(prestationsValue);
    const isSfrB2b = this.isSfrB2bMarque(marqueValue);

    if (articlesNormalized.includes('RACPAV')) codes.add('RACPAV');
    if (articlesNormalized.includes('RACIH')) codes.add('RACIH');
    if (
      !isSfrB2b
      && (
        articlesNormalized.includes('RECOIP')
        || operationNormalized.includes('RECONNEX')
        || typeNormalized.includes('RECO')
      )
    ) {
      codes.add('RECOIP');
    }
    if (isSfrB2b) {
      codes.add('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      codes.add('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      codes.add('RACPRO_C');
    }
    if (articlesNormalized.includes('SAV') || typeNormalized === 'SAV') {
      codes.add('SAV');
    }
    if (
      (typeNormalized.includes('PRESTA') && typeNormalized.includes('COMPL'))
      || articlesNormalized.includes('PRESTA_COMPL')
    ) {
      codes.add('PRESTA_COMPL');
    }
    if (
      articlesNormalized.includes('REPFOU_PRI')
      || commentairesNormalized.includes('F8')
      || prestationsNormalized.includes('FOURREAUX')
      || prestationsNormalized.includes('DOMAINE')
    ) {
      codes.add('REPFOU_PRI');
    }
    if (typeNormalized === 'REFC_DGR' || statusNormalized.includes('REFC_DGR')) {
      codes.add('REFC_DGR');
    }
    if (typeNormalized === 'DEPLPRISE' || articlesNormalized.includes('DEPLPRISE')) {
      codes.add('DEPLPRISE');
    }
    if (typeNormalized === 'REFRAC' || articlesNormalized.includes('REFRAC')) {
      codes.add('REFRAC');
    }

    if (isSfrB2b) {
      codes.delete('RECOIP');
    }

    return [...codes];
  }

  private normalizeHeaderKey(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/_/g, '');
  }

  private findHeaderIndex(normalizedHeader: string[], candidates: string[]): number {
    for (const candidate of candidates) {
      const idx = normalizedHeader.indexOf(this.normalizeHeaderKey(candidate));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  private normalizeToken(value?: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private isSfrB2bMarque(value?: string | null): boolean {
    const normalized = this.normalizeToken(value ?? '');
    if (!normalized) return false;
    if (normalized.includes('SFR B2B')) return true;
    return normalized.replace(/\s+/g, '').includes('SFRB2B');
  }

  private resetPreview(): void {
    this.previewColumns.set([]);
    this.previewRows.set(0);
    this.previewUnknownList.set([]);
    this.previewRecognizedList.set([]);
    this.previewLoading.set(false);
    this.previewError.set(null);
  }

  private apiError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      return err.error?.message || err.message || fallback;
    }
    return fallback;
  }
}
