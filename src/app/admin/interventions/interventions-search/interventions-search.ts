import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const SESSION_KEY = 'fxn_inter_search';

import {
  InterventionService,
  InterventionItem,
  InterventionFilters,
  InterventionSummaryQuery,
} from '../../../core/services/intervention.service';
import { downloadBlob } from '../../../core/utils/download';
import { formatPageRange } from '../../../core/utils/pagination';

const EMPTY_FILTERS: InterventionFilters = {
  regions: [], clients: [], societes: [], plaques: [], villes: [],
  statuses: [], technicians: [], types: [],
  gestionnaires: [], activites: [], typeOffres: [], typePons: [],
  marques: [], marqueGps: [], gems: [], categoriesRdv: [], statutsBox4g: [],
  typeLogements: [], parcours: [], multiSavs: [], equipements: [],
  regroupSavs: [], flagBots: [], provisionnings: [], motifEchecs: [],
};

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-interventions-search',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './interventions-search.html',
  styleUrls: ['./interventions-search.scss'],
})
export class InterventionsSearch implements OnInit {
  private svc = inject(InterventionService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exportLoading = signal(false);
  readonly searched = signal(false);

  readonly items = signal<InterventionItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(25);
  readonly filters = signal<InterventionFilters>(EMPTY_FILTERS);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly pageRange = computed(() => formatPageRange(this.page(), this.limit(), this.total()));

  readonly form = this.fb.nonNullable.group({
    region: [''], plaque: [''], ville: [''], rue: [''], codePostal: [''], idra: [''], idImmeuble: [''],
    societe: [''], technician: [''],
    numAbonne: [''], abonne: [''], raisonSociale: [''],
    numInter: [''], commandeId: [''], sct: [''], nomSro: [''], prise: [''],
    provisionning: [''], activite: [''],
    client: [''], gestionnaire: [''], type: [''], status: [''],
    motifEchec: [''], codeSec: [''], marque: [''], typeOffre: [''], typePon: [''],
    parcours: [''], multiSav: [''], gem: [''], statutBox4g: [''],
    transfoCable: [''], checkVoisin: [''], recoRacc: [''],
    equipement: [''], regroupSav: [''], categorieRdv: [''], flagBot: [''],
    fromDateRdv: [''], toDateRdv: [''], creneau: [''],
    fromDateCloture: [''], toDateCloture: [''],
    commNc: [''], noteHotline: [''], rapportTech: [''],
  });

  async ngOnInit(): Promise<void> {
    this.restoreState();
    try {
      const res = await firstValueFrom(this.svc.filters());
      if (res.success) this.filters.set({ ...EMPTY_FILTERS, ...res.data });
    } catch { /* filters are optional enhancements */ }
  }

  private saveState(): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        form: this.form.getRawValue(),
        items: this.items(),
        total: this.total(),
        page: this.page(),
        searched: this.searched(),
      }));
    } catch { /* sessionStorage peut être indisponible */ }
  }

  private restoreState(): void {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const state = JSON.parse(raw);
      this.form.patchValue(state.form ?? {});
      this.items.set(state.items ?? []);
      this.total.set(state.total ?? 0);
      this.page.set(state.page ?? 1);
      this.searched.set(state.searched ?? false);
    } catch { /* état corrompu, on ignore */ }
  }

  private clearState(): void {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  private buildQuery(): InterventionSummaryQuery {
    const f = this.form.getRawValue();
    return {
      fromDate: f.fromDateRdv || undefined,
      toDate: f.toDateRdv || undefined,
      fromDateCloture: f.fromDateCloture || undefined,
      toDateCloture: f.toDateCloture || undefined,
      technician: f.technician || undefined,
      region: f.region || undefined,
      client: f.client || undefined,
      societe: f.societe || undefined,
      plaque: f.plaque || undefined,
      ville: f.ville || undefined,
      rue: f.rue || undefined,
      codePostal: f.codePostal || undefined,
      idra: f.idra || undefined,
      idImmeuble: f.idImmeuble || undefined,
      numInter: f.numInter || undefined,
      commandeId: f.commandeId || undefined,
      numAbonne: f.numAbonne || undefined,
      abonne: f.abonne || undefined,
      raisonSociale: f.raisonSociale || undefined,
      sct: f.sct || undefined,
      nomSro: f.nomSro || undefined,
      prise: f.prise || undefined,
      codeSec: f.codeSec || undefined,
      status: f.status || undefined,
      type: f.type || undefined,
      gestionnaire: f.gestionnaire || undefined,
      marque: f.marque || undefined,
      typeOffre: f.typeOffre || undefined,
      typePon: f.typePon || undefined,
      provisionning: f.provisionning || undefined,
      activite: f.activite || undefined,
      parcours: f.parcours || undefined,
      multiSav: f.multiSav || undefined,
      gem: f.gem || undefined,
      statutBox4g: f.statutBox4g || undefined,
      transfoCable: f.transfoCable || undefined,
      checkVoisin: f.checkVoisin || undefined,
      recoRacc: f.recoRacc || undefined,
      equipement: f.equipement || undefined,
      regroupSav: f.regroupSav || undefined,
      categorieRdv: f.categorieRdv || undefined,
      flagBot: f.flagBot || undefined,
      creneau: f.creneau || undefined,
      motifEchec: f.motifEchec || undefined,
      commNc: f.commNc || undefined,
      noteHotline: f.noteHotline || undefined,
      rapportTech: f.rapportTech || undefined,
    };
  }

  async search(resetPage = true): Promise<void> {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.svc.list({ ...this.buildQuery(), page: this.page(), limit: this.limit() })
      );
      if (res.success) {
        this.items.set(res.data.items);
        this.total.set(res.data.total);
      }
      this.searched.set(true);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Erreur lors de la recherche');
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.form.reset();
    this.items.set([]);
    this.total.set(0);
    this.page.set(1);
    this.searched.set(false);
    this.error.set(null);
    this.clearState();
  }

  async exportCsv(): Promise<void> {
    this.exportLoading.set(true);
    try {
      const blob = await firstValueFrom(this.svc.exportCsv(this.buildQuery()));
      downloadBlob(blob, `recherche-interventions-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      this.error.set("Erreur lors de l'export");
    } finally {
      this.exportLoading.set(false);
    }
  }

  prevPage(): void { if (!this.canPrev()) return; this.page.update(p => p - 1); this.search(false); }
  nextPage(): void { if (!this.canNext()) return; this.page.update(p => p + 1); this.search(false); }

  openDetail(item: InterventionItem): void {
    this.saveState();
    this.router.navigate(['/admin/interventions/detail', item._id], { state: { item } });
  }

  technicianLabel(item: InterventionItem): string {
    if (item.techFull) return item.techFull;
    return [item.techFirstName, item.techLastName].filter(Boolean).join(' ') || '—';
  }

  dateLabel(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR');
  }
}
