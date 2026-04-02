import {
  Component,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// ─── Types du rapport ──────────────────────────────────────────────────────────

export interface AdminInfo {
  code: string;
  source: 'BPU' | 'PRESTATION';
  label: string;
  unitPrice: number | null;
  segment?: string;
}

export interface MatchedArticle {
  code: string;
  qty: number;
  raw: string;
  label?: string;
  unitPrice: number | null;
  source?: string;
}

export interface Suggestion {
  code: string;
  label: string;
  distance: number;
  matchType: string;
  source?: string;
}

export interface UnknownArticle {
  code: string;
  qty: number;
  raw: string;
  suggestions: Suggestion[];
}

export interface LineResult {
  numInter: string;
  rawArticles: string;
  matched: MatchedArticle[];
  unknown: UnknownArticle[];
}

export interface AnalysisStats {
  totalLines: number;
  linesWithArticles: number;
  totalArticleOccurrences: number;
  matchedOccurrences: number;
  unknownOccurrences: number;
  matchRate: number;
  uniqueMatchedCodes: number;
  uniqueUnknownCodes: number;
}

export interface AnalysisReport {
  stats: AnalysisStats;
  matchedCodes: Record<string, { count: number; adminInfo: AdminInfo }>;
  unknownCodes: Record<string, { count: number; suggestions: Suggestion[]; rawExamples: string[] }>;
  notSeenInCsv: AdminInfo[];
  lines: LineResult[];
}

type ApiResponse<T> = { success: boolean; data: T; message?: string };

// ─── Composant ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-bpu-analyzer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  templateUrl: './bpu-analyzer.html',
  styleUrl: './bpu-analyzer.scss'
})
export class BpuAnalyzer {
  private router = inject(Router);
  private http = inject(HttpClient);

  readonly selectedFile = signal<File | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly report = signal<AnalysisReport | null>(null);

  readonly activeTab = signal<'stats' | 'matched' | 'unknown' | 'notseen' | 'lines'>('stats');

  readonly matchedCodesArray = computed(() => {
    const r = this.report();
    if (!r) return [];
    return Object.entries(r.matchedCodes)
      .map(([code, val]) => ({ code, ...val }))
      .sort((a, b) => b.count - a.count);
  });

  readonly unknownCodesArray = computed(() => {
    const r = this.report();
    if (!r) return [];
    return Object.entries(r.unknownCodes)
      .map(([code, val]) => ({ code, ...val }))
      .sort((a, b) => b.count - a.count);
  });

  readonly linesWithUnknown = computed(() =>
    (this.report()?.lines ?? []).filter((l) => l.unknown.length > 0)
  );

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.report.set(null);
    this.error.set(null);
  }

  analyze(): void {
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Veuillez sélectionner un fichier CSV OSIRIS.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.loading.set(true);
    this.error.set(null);
    this.report.set(null);

    this.http
      .post<ApiResponse<AnalysisReport>>(
        `${environment.apiBaseUrl}/bpu/analyze-articles`,
        formData
      )
      .subscribe({
        next: (resp) => {
          this.report.set(resp.data);
          this.activeTab.set('stats');
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          const msg =
            typeof err.error === 'object' && err.error?.message
              ? String(err.error.message)
              : err.message || 'Erreur analyse';
          this.error.set(msg);
          this.loading.set(false);
        }
      });
  }

  setTab(tab: 'stats' | 'matched' | 'unknown' | 'notseen' | 'lines'): void {
    this.activeTab.set(tab);
  }

  goBack(): void {
    this.router.navigate(['/admin/bpu']).then();
  }

  matchRateClass(rate: number): string {
    if (rate >= 90) return 'rate-high';
    if (rate >= 60) return 'rate-medium';
    return 'rate-low';
  }

  formatFileName(): string {
    const f = this.selectedFile();
    if (!f) return '';
    return f.name.length > 40 ? f.name.slice(0, 37) + '...' : f.name;
  }
}
