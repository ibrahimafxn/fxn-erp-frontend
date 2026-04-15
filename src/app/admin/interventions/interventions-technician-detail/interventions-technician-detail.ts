import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { combineLatest } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { InterventionItem, InterventionService } from '../../../core/services/intervention.service';
import { formatPageRange } from '../../../core/utils/pagination';
import { isRacihSuccess, isRacpavSuccess } from '../../../core/utils/intervention-prestations';
import { preferredPageSize } from '../../../core/utils/page-size';

type DetailFilters = {
  fromDate: string;
  toDate: string;
  region: string;
  client: string;
  status: string;
  type: string;
};

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-interventions-technician-detail',
  imports: [CommonModule, RouterModule],
  templateUrl: './interventions-technician-detail.html',
  styleUrls: ['./interventions-technician-detail.scss']
})
export class InterventionsTechnicianDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private svc = inject(InterventionService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<InterventionItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly technician = signal('');
  readonly pageRange = formatPageRange;

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });

  readonly detailGroups = computed(() => {
    const items = this.items();
    const order = [
      { key: 'racPavillon', label: 'Raccordement pavillon' },
      { key: 'racImmeuble', label: 'Raccordement immeuble' },
      { key: 'reconnexion', label: 'Reconnexion' },
      { key: 'sav', label: 'SAV' },
      { key: 'b2b', label: 'Raccordement B2B' },
      { key: 'other', label: 'Autres' }
    ];
    const buckets = new Map(order.map((group) => [group.key, [] as InterventionItem[]]));

    for (const item of items) {
      const categories = Array.isArray(item.categories) ? item.categories : [];
      const type = this.normalizeText(item.type);
      const status = this.normalizeText(item.statut);
      const isClosed = status.includes('CLOTURE') && status.includes('TERMINEE');
      const isSfrB2b = this.isSfrB2bMarque(item.marque);
      const isReconnexion = !isSfrB2b && (type.includes('RECO') || this.hasReconnexionInArticles(item.articlesRaw));
      const isB2b = categories.includes('racProS')
        || categories.includes('racProC')
        || this.hasB2bInArticles(item.articlesRaw);
      const successMatches = this.resolveSuccessPrestations(item);
      let key = 'other';
      if (successMatches.length) {
        if (successMatches.includes('RACPAV')) key = 'racPavillon';
        else if (successMatches.includes('RACIH')) key = 'racImmeuble';
        else if (successMatches.includes('RECOIP') && !isSfrB2b) key = 'reconnexion';
        else if (successMatches.includes('SAV')) key = 'sav';
        else if (successMatches.includes('RACPRO_S') || successMatches.includes('RACPRO_C')) key = 'b2b';
      } else {
        if (isClosed && isReconnexion) key = 'reconnexion';
        else if (categories.includes('racPavillon')) key = 'racPavillon';
        else if (categories.includes('racImmeuble')) key = 'racImmeuble';
        else if (categories.includes('reconnexion') && !isSfrB2b) key = 'reconnexion';
        else if (categories.includes('sav')) key = 'sav';
        else if (isB2b) key = 'b2b';
        else {
          if (type.includes('PRESTA') && type.includes('COMPL')) key = 'other';
          else if (type.includes('SAV')) key = 'sav';
          else if (isReconnexion) key = 'reconnexion';
        }
      }
      (buckets.get(key) || buckets.get('other'))?.push(item);
    }

    return order
      .map((group) => ({ ...group, items: buckets.get(group.key) || [] }))
      .filter((group) => group.items.length > 0);
  });

  private readonly filters = signal<DetailFilters>({
    fromDate: '',
    toDate: '',
    region: '',
    client: '',
    status: '',
    type: ''
  });

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      const tech = params.get('technician') || '';
      this.technician.set(tech);
      this.filters.set({
        fromDate: query.get('fromDate') || '',
        toDate: query.get('toDate') || '',
        region: query.get('region') || '',
        client: query.get('client') || '',
        status: query.get('status') || '',
        type: query.get('type') || ''
      });

      const page = Number(query.get('page') || 1);
      const limit = Number(query.get('limit') || 20);
      this.page.set(Number.isFinite(page) && page > 0 ? page : 1);
      this.limit.set(Number.isFinite(limit) && limit > 0 ? limit : 20);

      this.load();
    });
  }

  goBack(): void {
    this.location.back();
  }

  prevPage(): void {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.load();
  }

  nextPage(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.set(this.page() + 1);
    this.load();
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.load();
  }

  formatArticleCodes(raw?: string | null): string {
    if (!raw) return '—';
    const excluded = new Set(['CABLE_PAV_1', 'CABLE_PAV_2', 'CABLE_PAV_3', 'CABLE_PAV_4']);
    const parts = String(raw)
      .split(/[,;+]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/"/g, '').trim())
      .map((part) => part.replace(/\s+x?\d+$/i, '').trim())
      .filter(Boolean)
      .map((part) => part.toUpperCase())
      .filter((part) => !excluded.has(part));
    return parts.length ? parts.join(', ') : '—';
  }

  private load(): void {
    const tech = this.technician();
    if (!tech) {
      this.error.set('Technicien introuvable.');
      return;
    }
    const f = this.filters();
    this.loading.set(true);
    this.error.set(null);

    this.svc.list({
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined,
      technician: tech,
      region: f.region || undefined,
      client: f.client || undefined,
      status: f.status || undefined,
      type: f.type || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        this.items.set(res.data.items || []);
        this.total.set(res.data.total ?? 0);
        if (res.data.page) this.page.set(res.data.page);
        if (res.data.limit) this.limit.set(res.data.limit);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.error.set(apiMsg || err.message || 'Erreur chargement interventions');
      }
    });
  }

  private normalizeText(value?: string | null): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private isSfrB2bMarque(value?: string | null): boolean {
    const normalized = this.normalizeText(value);
    if (!normalized) return false;
    if (normalized.includes('SFR B2B')) return true;
    return normalized.replace(/\s+/g, '').includes('SFRB2B');
  }

  private hasReconnexionInArticles(raw?: string | null): boolean {
    const normalized = this.normalizeText(raw);
    if (!normalized) return false;
    return normalized.includes('RECOIP') || normalized.includes('RECO');
  }

  private hasB2bInArticles(raw?: string | null): boolean {
    const normalized = this.normalizeText(raw);
    if (!normalized) return false;
    return normalized.includes('RACPRO') || normalized.includes('RAC PRO');
  }

  private resolveSuccessPrestations(item: InterventionItem): string[] {
    const statusNormalized = this.normalizeText(item.statut);
    if (!(statusNormalized.includes('CLOTURE') && statusNormalized.includes('TERMINEE'))) {
      return [];
    }
    const typeNormalized = this.normalizeText(item.type).replace(/-/g, ' ').trim();
    const articlesNormalized = this.normalizeText(item.articlesRaw);
    const operationNormalized = this.normalizeText(item.typeOperation);
    const commentsNormalized = this.normalizeText(item.commentairesTechnicien);
    const prestationsNormalized = this.normalizeText(item.listePrestationsRaw);
    const isSfrB2b = this.isSfrB2bMarque(item.marque);
    const matches: string[] = [];

    if (isRacpavSuccess(item.statut, item.articlesRaw)) matches.push('RACPAV');
    if (isRacihSuccess(item.statut, item.articlesRaw)) matches.push('RACIH');
    if (
      !isSfrB2b
      && (
        articlesNormalized.includes('RECOIP')
        || operationNormalized.includes('RECONNEX')
        || typeNormalized.includes('RECO')
      )
    ) {
      matches.push('RECOIP');
    }
    if (isSfrB2b) {
      matches.push('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROS_S') || articlesNormalized.includes('RACPRO_S')) {
      matches.push('RACPRO_S');
    }
    if (articlesNormalized.includes('RACPROC_C') || articlesNormalized.includes('RACPRO_C')) {
      matches.push('RACPRO_C');
    }
    if (articlesNormalized.includes('SAV') || typeNormalized === 'SAV') {
      matches.push('SAV');
    }
    if (
      (typeNormalized.includes('PRESTA') && typeNormalized.includes('COMPL'))
      || articlesNormalized.includes('PRESTA_COMPL')
    ) {
      matches.push('PRESTA_COMPL');
    }
    if (
      articlesNormalized.includes('REPFOU_PRI')
      || commentsNormalized.includes('F8')
      || prestationsNormalized.includes('FOURREAUX')
      || prestationsNormalized.includes('DOMAINE')
    ) {
      matches.push('REPFOU_PRI');
    }
    if (typeNormalized === 'REFC_DGR' || statusNormalized.includes('REFC_DGR')) {
      matches.push('REFC_DGR');
    }
    if (typeNormalized === 'DEPLPRISE' || articlesNormalized.includes('DEPLPRISE')) {
      matches.push('DEPLPRISE');
    }
    if (typeNormalized === 'REFRAC' || articlesNormalized.includes('REFRAC')) {
      matches.push('REFRAC');
    }

    return matches;
  }
}
