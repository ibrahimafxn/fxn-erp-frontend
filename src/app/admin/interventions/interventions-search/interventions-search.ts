import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  InterventionService,
  InterventionItem,
  InterventionFilters,
} from '../../../core/services/intervention.service';
import { downloadBlob } from '../../../core/utils/download';
import { formatPageRange } from '../../../core/utils/pagination';

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

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exportLoading = signal(false);
  readonly searched = signal(false);

  readonly items = signal<InterventionItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(25);

  readonly filters = signal<InterventionFilters>({
    regions: [],
    clients: [],
    statuses: [],
    technicians: [],
    types: [],
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly pageRange = computed(() => formatPageRange(this.page(), this.limit(), this.total()));

  readonly form = this.fb.nonNullable.group({
    region: [''],
    plaque: [''],
    ville: [''],
    rue: [''],
    codePostal: [''],
    idra: [''],
    idImmeuble: [''],

    societe: [''],
    technician: [''],
    numAbonne: [''],
    abonne: [''],
    raisonSociale: [''],
    numInter: [''],
    commandeId: [''],
    sct: [''],
    nomSro: [''],
    prise: [''],
    provisionning: [''],
    activite: [''],

    client: [''],
    gestionnaire: [''],
    type: [''],
    status: [''],
    echec: [''],
    codeSec: [''],
    marque: [''],
    typeOffre: [''],
    typePon: [''],
    parcours: [''],
    multiSav: [''],
    gem: [''],
    statutBox4g: [''],
    transfoCable: [''],
    checkVoisin: [''],
    recoRacc: [''],
    equipement: [''],
    regroupSav: [''],
    categorieRdv: [''],
    flagBot: [''],

    fromDateRdv: [''],
    toDateRdv: [''],
    creneau: [''],
    fromDateCloture: [''],
    toDateCloture: [''],

    commNc: [''],
    noteHotline: [''],
    rapportTech: [''],
  });

  async ngOnInit(): Promise<void> {
    try {
      const res = await firstValueFrom(this.svc.filters());
      if (res.success) this.filters.set(res.data);
    } catch {
      /* filters are optional enhancements */
    }
  }

  async search(resetPage = true): Promise<void> {
    if (resetPage) this.page.set(1);
    this.loading.set(true);
    this.error.set(null);
    try {
      const f = this.form.getRawValue();
      const res = await firstValueFrom(
        this.svc.list({
          fromDate: f.fromDateRdv || undefined,
          toDate: f.toDateRdv || undefined,
          technician: f.technician || undefined,
          region: f.region || undefined,
          client: f.client || undefined,
          numInter: f.numInter || undefined,
          status: f.status || undefined,
          type: f.type || undefined,
          page: this.page(),
          limit: this.limit(),
        })
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
  }

  async exportCsv(): Promise<void> {
    this.exportLoading.set(true);
    try {
      const f = this.form.getRawValue();
      const blob = await firstValueFrom(
        this.svc.exportCsv({
          fromDate: f.fromDateRdv || undefined,
          toDate: f.toDateRdv || undefined,
          technician: f.technician || undefined,
          region: f.region || undefined,
          client: f.client || undefined,
          numInter: f.numInter || undefined,
          status: f.status || undefined,
          type: f.type || undefined,
        })
      );
      downloadBlob(blob, `recherche-interventions-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      this.error.set("Erreur lors de l'export");
    } finally {
      this.exportLoading.set(false);
    }
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.update(p => p - 1);
    this.search(false);
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.update(p => p + 1);
    this.search(false);
  }

  technicianLabel(item: InterventionItem): string {
    if (item.techFull) return item.techFull;
    return [item.techFirstName, item.techLastName].filter(Boolean).join(' ') || '—';
  }

  dateLabel(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('fr-FR');
  }
}
