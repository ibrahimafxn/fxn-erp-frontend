import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  OsirisEquipmentService,
  OsirisImportResult,
  OsirisTechnicianSummary,
} from '../../../core/services/osiris-equipment.service';

type CsvPreviewRow = {
  stock: string;
  serialNumber: string;
  type: string;
  codeProcable: string;
  lot: string;
  dateEntree: string;
};

@Component({
  selector: 'app-osiris-import',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './osiris-import.html',
  styleUrl: './osiris-import.scss',
})
export class OsirisImport {
  private svc = inject(OsirisEquipmentService);
  private cdr = inject(ChangeDetectorRef);

  readonly fileName = signal<string | null>(null);
  readonly csvContent = signal<string | null>(null);
  readonly previewRows = signal<CsvPreviewRow[]>([]);
  readonly totalRows = signal(0);

  readonly importing = signal(false);
  readonly importResult = signal<OsirisImportResult | null>(null);
  readonly importError = signal<string | null>(null);

  readonly summaryLoading = signal(false);
  readonly summaryError = signal<string | null>(null);
  readonly summary = signal<OsirisTechnicianSummary[]>([]);

  readonly clearingAll = signal(false);
  readonly showClearConfirm = signal(false);

  readonly reResolving = signal(false);
  readonly reResolveResult = signal<{ total: number; resolved: number; unresolved: number } | null>(null);

  readonly hasFile = computed(() => this.csvContent() !== null);
  readonly canImport = computed(() => this.hasFile() && !this.importing());

  constructor() {
    this.loadSummary();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fileName.set(file.name);
    this.importResult.set(null);
    this.importError.set(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.csvContent.set(text);
      this.parsePreview(text);
      this.cdr.markForCheck();
    };
    reader.readAsText(file, 'windows-1252');
  }

  private parsePreview(text: string): void {
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      this.previewRows.set([]);
      this.totalRows.set(0);
      return;
    }

    const header = lines[0].split(';').map((h) => h.trim().replace(/^"|"$/g, '').toUpperCase().replace(/\s/g, ''));
    const idx = {
      STOCK: header.indexOf('STOCK'),
      NOSERIE: header.indexOf('NOSERIE'),
      TYPE: header.indexOf('TYPE'),
      CODEPROCABLE: header.indexOf('CODEPROCABLE'),
      LOT: header.indexOf('LOT'),
      DATEENTREE: header.indexOf('DATEENTREE'),
    };

    const dataLines = lines.slice(1);
    this.totalRows.set(dataLines.filter((l) => l.split(';')[idx.NOSERIE]?.trim()).length);

    const preview: CsvPreviewRow[] = dataLines.slice(0, 8).map((line) => {
      const cols = line.split(';').map((c) => c.trim().replace(/^"|"$/g, ''));
      const get = (i: number) => (i >= 0 ? cols[i] || '' : '');
      return {
        stock: get(idx.STOCK),
        serialNumber: get(idx.NOSERIE),
        type: get(idx.TYPE),
        codeProcable: get(idx.CODEPROCABLE),
        lot: get(idx.LOT),
        dateEntree: get(idx.DATEENTREE),
      };
    }).filter((r) => r.serialNumber);

    this.previewRows.set(preview);
  }

  import(): void {
    const csv = this.csvContent();
    if (!csv || this.importing()) return;

    this.importing.set(true);
    this.importResult.set(null);
    this.importError.set(null);

    this.svc.importCsv(csv).subscribe({
      next: (res) => {
        this.importing.set(false);
        this.importResult.set(res.data);
        this.loadSummary();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.importing.set(false);
        this.importError.set(err?.error?.message || err?.message || 'Erreur import');
        this.cdr.markForCheck();
      },
    });
  }

  clearFile(): void {
    this.fileName.set(null);
    this.csvContent.set(null);
    this.previewRows.set([]);
    this.totalRows.set(0);
    this.importResult.set(null);
    this.importError.set(null);
  }

  confirmClearAll(): void {
    this.showClearConfirm.set(true);
  }

  cancelClearAll(): void {
    this.showClearConfirm.set(false);
  }

  reResolve(): void {
    if (this.reResolving()) return;
    this.reResolving.set(true);
    this.reResolveResult.set(null);
    this.svc.reResolve().subscribe({
      next: (res) => {
        this.reResolving.set(false);
        this.reResolveResult.set(res.data);
        this.loadSummary();
        this.cdr.markForCheck();
      },
      error: () => {
        this.reResolving.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  clearAll(): void {
    this.showClearConfirm.set(false);
    this.clearingAll.set(true);
    this.svc.deleteAll().subscribe({
      next: () => {
        this.clearingAll.set(false);
        this.summary.set([]);
        this.cdr.markForCheck();
      },
      error: () => {
        this.clearingAll.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.svc.summary().subscribe({
      next: (res) => {
        this.summary.set(res.data);
        this.summaryLoading.set(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.summaryError.set(err?.error?.message || err?.message || 'Erreur chargement');
        this.summaryLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  techName(row: OsirisTechnicianSummary): string {
    if (row.firstName || row.lastName) return `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();
    // Extraire le nom depuis la colonne STOCK brute (ex: "FXN.86 - HAMOU Heidi")
    const raw = row.technicianRaw || '';
    const idx = raw.indexOf(' - ');
    return idx !== -1 ? raw.slice(idx + 3).trim() : raw;
  }
}
