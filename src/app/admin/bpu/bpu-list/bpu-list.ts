import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BpuService } from '../../../core/services/bpu.service';
import { BpuSelectionService } from '../../../core/services/bpu-selection.service';
import { BpuEntry } from '../../../core/models';
import { downloadBlob } from '../../../core/utils/download';

type Segment = 'AUTO' | 'SALARIE' | 'ASSOCIE';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-bpu-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './bpu-list.html',
  styleUrl: './bpu-list.scss'
})
export class BpuList {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private bpuService = inject(BpuService);
  private bpuSelectionService = inject(BpuSelectionService);

  readonly items = signal<BpuEntry[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly currentSegment = signal<Segment>('AUTO');
  readonly isEditing = signal(false);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly selectedCodes = signal<Set<string>>(new Set());
  readonly editedPrices = signal<Map<string, number>>(new Map());

  readonly sortedItems = computed(() => {
    const dir = this.sortDir();
    const factor = dir === 'asc' ? 1 : -1;
    const items = [...this.items()];
    items.sort((a, b) => factor * String(a.prestation || '').localeCompare(String(b.prestation || '')));
    return items;
  });

  constructor() {
    const segment = this.route.snapshot.queryParamMap.get('segment');
    if (segment === 'AUTO' || segment === 'SALARIE') {
      this.currentSegment.set(segment);
      this.isEditing.set(true);
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    const segment = this.currentSegment();
    const items$ = segment === 'ASSOCIE'
      ? this.bpuService.list(segment).pipe(
          switchMap((items) => (items.length ? of(items) : this.bpuService.list()))
        )
      : this.bpuService.list(segment);
    forkJoin({
      items: items$,
      selections: this.bpuSelectionService.list()
    }).subscribe({
      next: ({ items, selections }) => {
        const uniqueItems = this.uniqueItems(items);
        this.items.set(uniqueItems);
        const selection = selections.find((item) => item.type === segment);
        const availableCodes = new Set(uniqueItems.map((item) => item.code).filter(Boolean) as string[]);
        const selected = new Set<string>();
        const edited = new Map<string, number>();
        for (const entry of selection?.prestations || []) {
          const code = String(entry.code || '').trim().toUpperCase();
          if (!code || !availableCodes.has(code)) continue;
          selected.add(code);
          edited.set(code, Number(entry.unitPrice || 0));
        }
        this.selectedCodes.set(selected);
        this.editedPrices.set(edited);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.apiError(err, 'Erreur chargement BPU'));
        this.loading.set(false);
      }
    });
  }

  onSegmentChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    const segment = target.value as Segment;
    if (segment === this.currentSegment()) return;
    this.currentSegment.set(segment);
    this.isEditing.set(false);
    this.selectedCodes.set(new Set());
    this.editedPrices.set(new Map());
    this.load();
  }

  toggleSortPrestation(): void {
    this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
  }

  sortIndicator(): string {
    return this.sortDir() === 'asc' ? '^' : 'v';
  }

  createNew(): void {
    this.router.navigate(['/admin/bpu/prestations/new']).then();
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    this.router.navigate(['/admin/bpu']).then();
  }

  toggleSelection(item: BpuEntry): void {
    const code = item.code;
    if (!code) return;
    const next = new Set(this.selectedCodes());
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    this.selectedCodes.set(next);
    this.success.set(null);
  }

  isSelected(item: BpuEntry): boolean {
    const code = item.code;
    return !!code && this.selectedCodes().has(code);
  }

  allSelected(): boolean {
    const items = this.items().filter((item) => item.code);
    return items.length > 0 && items.every((item) => this.selectedCodes().has(item.code));
  }

  toggleSelectAll(): void {
    const items = this.items().filter((item) => item.code);
    const next = new Set<string>();
    const shouldSelectAll = !this.allSelected();
    if (shouldSelectAll) {
      for (const item of items) {
        next.add(item.code);
      }
    }
    this.selectedCodes.set(next);
    this.success.set(null);
  }

  priceValue(item: BpuEntry): number {
    const code = item.code;
    if (!code) return Number(item.unitPrice || 0);
    const override = this.editedPrices().get(code);
    return Number.isFinite(override) ? Number(override) : Number(item.unitPrice || 0);
  }

  onPriceChange(item: BpuEntry, event: Event): void {
    const code = item.code;
    const target = event.target as HTMLInputElement | null;
    if (!code || !target) return;
    const value = Number(target.value);
    const next = new Map(this.editedPrices());
    if (!Number.isFinite(value)) {
      next.delete(code);
    } else {
      next.set(code, value);
    }
    this.editedPrices.set(next);
    this.success.set(null);
  }

  hasSelection(): boolean {
    return this.selectedCodes().size > 0;
  }

  saveSelection(): void {
    if (!this.hasSelection()) {
      this.error.set('Veuillez sélectionner au moins une prestation.');
      return;
    }
    const type = this.currentSegment();
    const selected = this.items().filter((item) => item.code && this.selectedCodes().has(item.code));
    const prestations = selected
      .map((item) => ({
        code: item.code,
        unitPrice: this.priceValue(item)
      }))
      .filter((item) => item.code && Number.isFinite(item.unitPrice));

    if (!prestations.length) {
      this.error.set('Aucune prestation valide à enregistrer.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.bpuSelectionService.create({ type, prestations }).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedCodes.set(new Set());
        this.success.set('BPU enregistré avec succès.');
        this.router.navigate(['/admin/bpu'], { queryParams: { saved: '1' } }).then();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.apiError(err, 'Erreur sauvegarde BPU'));
      }
    });
  }

  exportCsv(): void {
    this.bpuService.exportCsv().subscribe({
      next: (blob) => downloadBlob(blob, 'bpu.csv'),
      error: (err: HttpErrorResponse) => {
        this.error.set(this.apiError(err, 'Erreur export CSV'));
      }
    });
  }

  exportPdf(): void {
    this.bpuService.exportPdf().subscribe({
      next: (blob) => downloadBlob(blob, 'bpu.pdf'),
      error: (err: HttpErrorResponse) => {
        this.error.set(this.apiError(err, 'Erreur export PDF'));
      }
    });
  }

  isBluePill(code?: string): boolean {
    return code === 'RACPAV' || code === 'RACIH' || code === 'RACPRO_S' || code === 'RACPRO_C' || code === 'REFRAC' || code === 'REFC_DGR';
  }

  isOrangePill(code?: string): boolean {
    return code === 'SAV';
  }

  isGreenPill(code?: string): boolean {
    return code === 'PRESTA_COMPL';
  }

  isYellowPill(code?: string): boolean {
    return code === 'RECOIP' || code === 'DEPLPRISE';
  }

  isRedText(code?: string): boolean {
    return code === 'RACPRO_S' || code === 'RACPRO_C';
  }

  isAquaPill(code?: string): boolean {
    return code === 'REPFOU_PRI' || code === 'DEMO';
  }

  isTurquoisePill(code?: string): boolean {
    return code === 'CLEM';
  }

  isVioletPill(code?: string): boolean {
    return code === 'CABLE_PAV_1' || code === 'CABLE_PAV_2' || code === 'CABLE_PAV_3' || code === 'CABLE_PAV_4';
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }

  private uniqueItems(items: BpuEntry[]): BpuEntry[] {
    const seen = new Set<string>();
    const result: BpuEntry[] = [];
    for (const item of items) {
      const rawKey = item.code || item.prestation || '';
      const key = rawKey.trim().toUpperCase();
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      result.push(item);
    }
    return result;
  }
}
