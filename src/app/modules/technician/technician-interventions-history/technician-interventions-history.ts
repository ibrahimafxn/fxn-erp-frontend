import {CommonModule, DatePipe} from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { InterventionItem, InterventionService } from '../../../core/services/intervention.service';
import { INTERVENTION_PRESTATION_FIELDS } from '../../../core/constant/intervention-prestations';
import { PaginationState } from '../../../core/utils/pagination-state';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';
import { preferredPageSize } from '../../../core/utils/page-size';

@Component({
  selector: 'app-technician-interventions-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TechnicianMobileNav],
  templateUrl: './technician-interventions-history.html',
  styleUrls: ['./technician-interventions-history.scss']
})
export class TechnicianInterventionsHistory {
  private interventions = inject(InterventionService);
  private fb = inject(FormBuilder);

  private readonly pag = new PaginationState();
  readonly page = this.pag.page;
  readonly limit = this.pag.limit;
  readonly total = this.pag.total;
  readonly pageRange = this.pag.pageRange;
  readonly pageCount = this.pag.pageCount;
  readonly canPrev = this.pag.canPrev;
  readonly canNext = this.pag.canNext;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<InterventionItem[]>([]);
  readonly expandedId = signal<string | null>(null);
  readonly sortField = signal<'date' | 'numInter' | 'client' | 'type' | 'typeOperation' | 'typeLogement' | 'statut'>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  readonly filterForm = this.fb.nonNullable.group({
    numInter: this.fb.nonNullable.control(''),
    type: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control(''),
    client: this.fb.nonNullable.control(''),
    fromDate: this.fb.nonNullable.control(''),
    toDate: this.fb.nonNullable.control('')
  });

  readonly typeOptions = INTERVENTION_PRESTATION_FIELDS.map((field) => ({
    value: field.code,
    label: field.label
  }));

  readonly statusOptions = [
    { value: 'CLOTURE TERMINEE', label: 'Cloture terminee' },
    { value: 'ECHEC TERMINE', label: 'Echec termine' },
    { value: 'ECHEC', label: 'Echec' },
    { value: 'ANNULE', label: 'Annule' },
    { value: 'EN COURS', label: 'En cours' }
  ];

  readonly sortedItems = computed(() => {
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    return [...this.items()].sort((a, b) => this.sortItems(a, b, field, dir));
  });

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    const f = this.filterForm.getRawValue();
    this.interventions.list({
      page: this.page(),
      limit: this.limit(),
      numInter: f.numInter.trim() || undefined,
      type: f.type.trim() || undefined,
      status: f.status.trim() || undefined,
      client: f.client.trim() || undefined,
      fromDate: f.fromDate || undefined,
      toDate: f.toDate || undefined
    }).subscribe({
      next: (res) => {
        this.items.set(res.data.items || []);
        this.total.set(res.data.total || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement interventions');
      }
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.refresh();
  }

  clearFilters(): void {
    this.filterForm.setValue({
      numInter: '',
      type: '',
      status: '',
      client: '',
      fromDate: '',
      toDate: ''
    });
    this.page.set(1);
    this.refresh();
  }

  prevPage(): void { this.pag.prevPage(() => this.refresh()); }
  nextPage(): void { this.pag.nextPage(() => this.refresh()); }
  setLimitValue(v: number): void { this.pag.setLimitValue(v, () => this.refresh()); }

  dateLabel(value?: string | null): string {
    if (!value) return '—';
    return new DatePipe('fr-FR').transform(value, 'shortDate') ?? '—';
  }

  setSort(field: 'date' | 'numInter' | 'client' | 'type' | 'typeOperation' | 'typeLogement' | 'statut'): void {
    if (this.sortField() === field) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortField.set(field);
    this.sortDirection.set(field === 'date' ? 'desc' : 'asc');
  }

  sortArrow(field: 'date' | 'numInter' | 'client' | 'type' | 'typeOperation' | 'typeLogement' | 'statut'): string {
    if (this.sortField() !== field) return '';
    return this.sortDirection() === 'asc' ? '▲' : '▼';
  }

  isExpanded(item: InterventionItem): boolean {
    return this.expandedId() === item._id;
  }

  toggleDetails(item: InterventionItem): void {
    this.expandedId.update((current) => (current === item._id ? null : item._id));
  }

  detailRows(item: InterventionItem): { label: string; value: string }[] {
    const baseRows = [
      { label: 'Numéro', value: this.textValue(item.numInter) },
      { label: 'Client', value: this.textValue(item.client) },
      { label: 'Technicien', value: this.textValue(item.techFull || [item.techFirstName, item.techLastName].filter(Boolean).join(' ')) },
      { label: 'Date RDV', value: this.formatDateTime(item.dateRdv, 'short') },
      { label: 'Type', value: this.textValue(item.type) },
      { label: 'Type opération', value: this.textValue(item.typeOperation) },
      { label: 'Type logement', value: this.textValue(item.typeLogement) },
      { label: 'Statut', value: this.textValue(item.statut) },
      { label: 'Ville', value: this.textValue(item.ville) },
      { label: 'Région', value: this.textValue(item.region) },
      { label: 'Société', value: this.textValue(item.societe) },
      { label: 'Plaque', value: this.textValue(item.plaque) },
      { label: 'Début', value: this.formatDateTime(item.debut, 'shortTime') },
      { label: 'Durée', value: this.textValue(item.duree) },
      { label: 'Début intervention', value: this.formatDateTime(item.debutIntervention, 'short') },
      { label: 'Clôture hotline', value: this.formatDateTime(item.clotureHotline, 'short') },
      { label: 'Clôture technicien', value: this.formatDateTime(item.clotureTech, 'short') },
      { label: 'Motif échec', value: this.textValue(item.motifEchec) },
      { label: 'Action SAV', value: this.textValue(item.actionSav) },
      { label: 'Type PBO', value: this.textValue(item.typePbo) },
      { label: 'Type habitation', value: this.textValue(item.typeHabitation) },
      { label: 'Prise existante', value: this.textValue(item.priseExistante) },
      { label: 'Marque', value: this.textValue(item.marque) },
      { label: 'Longueur câble', value: this.textValue(item.longueurCable) },
      { label: 'Créneau +2h', value: this.textValue(item.creneauPlus2h) },
      { label: 'Recommandation', value: this.textValue(item.recoRacc) },
      { label: 'Prestations', value: this.textValue(item.listePrestationsRaw) },
      { label: 'Articles', value: this.textValue(item.articlesRaw) },
      { label: 'Catégories', value: this.listValue(item.categories) },
      { label: 'Succès', value: this.booleanValue(item.isSuccess) },
      { label: 'Échec', value: this.booleanValue(item.isFailure) },
      { label: 'Version', value: this.numberValue(item.versionIndex) },
      { label: 'Dernière version ID', value: this.textValue(item.latestVersionId) },
      { label: 'Commentaire technicien', value: this.textValue(item.commentairesTechnicien) },
      { label: 'Commentaire clôture', value: this.textValue(item.commentairesCloture) },
      { label: 'Importé le', value: this.formatDateTime(item.importedAt, 'short') }
    ];
    const rawRows = Object.entries(item.osirisRaw || {})
      .filter(([, value]) => this.normalizeText(value))
      .map(([key, value]) => ({
        label: `OSIRIS · ${key}`,
        value: this.textValue(value)
      }));
    return [...baseRows, ...rawRows];
  }

  private sortItems(
    a: InterventionItem,
    b: InterventionItem,
    field: 'date' | 'numInter' | 'client' | 'type' | 'typeOperation' | 'typeLogement' | 'statut',
    dir: number
  ): number {
    if (field === 'date') {
      const aDate = this.parseDateValue(a.dateRdv) || this.parseDateValue(a.importedAt);
      const bDate = this.parseDateValue(b.dateRdv) || this.parseDateValue(b.importedAt);
      return (aDate - bDate) * dir;
    }
    const aVal = this.normalizeText(
      field === 'numInter' ? a.numInter :
      field === 'client' ? a.client :
      field === 'type' ? a.type :
      field === 'typeOperation' ? a.typeOperation :
      field === 'typeLogement' ? a.typeLogement :
      a.statut
    );
    const bVal = this.normalizeText(
      field === 'numInter' ? b.numInter :
      field === 'client' ? b.client :
      field === 'type' ? b.type :
      field === 'typeOperation' ? b.typeOperation :
      field === 'typeLogement' ? b.typeLogement :
      b.statut
    );
    return aVal.localeCompare(bVal, 'fr', { sensitivity: 'base' }) * dir;
  }

  private parseDateValue(value?: string | null): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  private normalizeText(value?: string | null): string {
    return String(value || '').trim();
  }

  private textValue(value?: string | null): string {
    return this.normalizeText(value) || '—';
  }

  private listValue(values?: string[] | null): string {
    if (!values?.length) return '—';
    const items = values.map((value) => this.normalizeText(value)).filter(Boolean);
    return items.length ? items.join(', ') : '—';
  }

  private booleanValue(value?: boolean | null): string {
    if (value == null) return '—';
    return value ? 'Oui' : 'Non';
  }

  private numberValue(value?: number | null): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return String(value);
  }

  private formatDateTime(value?: string | null, format: 'short' | 'shortDate' | 'shortTime' = 'short'): string {
    if (!value) return '—';
    return new DatePipe('fr-FR').transform(value, format) ?? '—';
  }
}
