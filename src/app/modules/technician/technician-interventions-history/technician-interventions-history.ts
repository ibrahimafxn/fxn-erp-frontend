import {CommonModule, DatePipe} from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { InterventionItem, InterventionService } from '../../../core/services/intervention.service';
import { INTERVENTION_PRESTATION_FIELDS } from '../../../core/constant/intervention-prestations';
import { formatPageRange } from '../../../core/utils/pagination';
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

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<InterventionItem[]>([]);
  readonly expandedId = signal<string | null>(null);
  readonly page = signal(1);
  readonly limit = signal(preferredPageSize());
  readonly total = signal(0);
  readonly pageRange = formatPageRange;
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

  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
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

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh();
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.refresh();
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh();
  }

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
    return [
      { label: 'Numéro', value: this.textValue(item.numInter) },
      { label: 'Client', value: this.textValue(item.client) },
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
      { label: 'Commentaire technicien', value: this.textValue(item.commentairesTechnicien) },
      { label: 'Commentaire clôture', value: this.textValue(item.commentairesCloture) },
      { label: 'Importé le', value: this.formatDateTime(item.importedAt, 'short') }
    ];
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

  private formatDateTime(value?: string | null, format: 'short' | 'shortDate' | 'shortTime' = 'short'): string {
    if (!value) return '—';
    return new DatePipe('fr-FR').transform(value, format) ?? '—';
  }
}
