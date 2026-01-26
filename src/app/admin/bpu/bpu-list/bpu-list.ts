import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BpuService } from '../../../core/services/bpu.service';
import { BpuEntry } from '../../../core/models';
import { downloadBlob } from '../../../core/utils/download';

type Segment = 'AUTO' | 'SALARIE';

@Component({
  standalone: true,
  selector: 'app-bpu-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './bpu-list.html',
  styleUrl: './bpu-list.scss'
})
export class BpuList {
  private router = inject(Router);
  private bpuService = inject(BpuService);

  readonly items = signal<BpuEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentSegment = signal<Segment>('AUTO');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  readonly sortedItems = computed(() => {
    const dir = this.sortDir();
    const factor = dir === 'asc' ? 1 : -1;
    const items = [...this.items()];
    items.sort((a, b) => factor * String(a.prestation || '').localeCompare(String(b.prestation || '')));
    return items;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const segment = this.currentSegment();
    this.bpuService.list(segment).subscribe({
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

  onSegmentChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    const segment = target.value as Segment;
    if (segment === this.currentSegment()) return;
    this.currentSegment.set(segment);
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
}
