import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BpuService } from '../../../core/services/bpu.service';
import { BpuSelectionService } from '../../../core/services/bpu-selection.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { HrService } from '../../../core/services/hr.service';
import { BpuEntry, BpuSelection, BpuPriceHistory, User } from '../../../core/models';
import { Role } from '../../../core/models/roles.model';
import { downloadBlob } from '../../../core/utils/download';
import { environment } from '../../../environments/environment';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';
import {
  INTERVENTION_PRESTATION_FIELDS,
  InterventionPrestationField
} from '../../../core/constant/intervention-prestations';
import { apiError } from '../../../core/utils/http-error';

type Segment = 'AUTO' | 'SALARIE' | 'PERSONNALISE' | 'AUTRE' | 'ERT';
type ConfirmAction = 'saveSelection' | 'updateCode' | 'addPrestation' | 'deletePersonalized' | 'updatePeriod';

const SEGMENT_LABELS: Record<Segment, string> = {
  AUTO: 'Freelance',
  SALARIE: 'Salarié',
  PERSONNALISE: 'Personnalisé',
  AUTRE: 'Autres',
  ERT: 'BPU ERT'
};

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-bpu-list',
  imports: [CommonModule, RouterModule, ConfirmActionModal],
  templateUrl: './bpu-list.html',
  styleUrl: './bpu-list.scss'
})
export class BpuList {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private bpuService = inject(BpuService);
  private bpuSelectionService = inject(BpuSelectionService);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private hrService = inject(HrService);

  readonly items = signal<BpuEntry[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly warning = signal<string | null>(null);
  readonly technicians = signal<User[]>([]);
  readonly techniciansLoading = signal(false);
  readonly techniciansError = signal<string | null>(null);
  readonly technicianSegments = signal<Map<string, Segment>>(new Map());
  readonly personalizedOwnerIds = signal<Set<string>>(new Set());
  readonly personalizedSelectionByOwner = signal<Map<string, BpuSelection>>(new Map());
  readonly selectedTechnicianId = signal<string | null>(null);
  readonly currentSegment = signal<Segment>('PERSONNALISE');
  readonly isEditing = signal(false);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly selectedCodes = signal<Set<string>>(new Set());
  readonly editedPrices = signal<Map<string, number>>(new Map());
  readonly editedCodes = signal<Map<string, string>>(new Map());
  readonly savingCodes = signal<Set<string>>(new Set());
  readonly newPrestation = signal({ prestation: '', code: '', unitPrice: 0 });
  readonly adding = signal(false);
  readonly showStitRef = signal(false);
  /** Date de début de validité saisie par l'admin avant d'enregistrer un BPU (format YYYY-MM-DD) */
  readonly selectionValidFrom = signal('');
  /** Historique des snapshots de prix pour le contexte courant */
  readonly priceHistory = signal<BpuPriceHistory[]>([]);
  readonly historyLoading = signal(false);
  readonly historyExpanded = signal<string | null>(null);
  readonly historyDeleting = signal<Set<string>>(new Set());
  /** Prix édités pour la période active (initialisé depuis le snapshot, modifiable) */
  readonly editedPeriodPrices = signal<Map<string, number>>(new Map());
  /** Codes cochés dans la période active (prestations sélectionnées dans le snapshot) */
  readonly editedPeriodCodes = signal<Set<string>>(new Set());
  /** Map<code, unitPrice> du snapshot actuellement développé (null = prix courants) */
  readonly activePeriodMap = computed<Map<string, number> | null>(() => {
    const id = this.historyExpanded();
    if (!id) return null;
    // Utilise les prix édités s'ils existent, sinon revient au snapshot
    const edited = this.editedPeriodPrices();
    if (edited.size) return edited;
    const entry = this.priceHistory().find(e => e._id === id);
    if (!entry) return null;
    const map = new Map<string, number>();
    for (const p of entry.prestations) {
      map.set(String(p.code || '').trim().toUpperCase(), Number(p.unitPrice ?? 0));
    }
    return map;
  });
  /** Affiche le tableau principal sauf si PERSONNALISE sans technicien sélectionné */
  readonly showMainTable = computed(() =>
    !(this.currentSegment() === 'PERSONNALISE' && !this.selectedTechnicianId())
  );

  readonly stitFields: InterventionPrestationField[] = INTERVENTION_PRESTATION_FIELDS;
  readonly BPU_STIT_PDF = 'assets/docs/bpu_list.pdf';
  readonly isTechnician = computed(() => this.auth.getUserRole() === Role.TECHNICIEN);
  readonly stitFieldsForView = computed(() => {
    if (!this.isTechnician()) return this.stitFields;
    const blocked = new Set(['BIFIBRE', 'NACELLE', 'CABLE_SL', 'PLV_PRO_C']);
    const pricedCodes = this.stitPriceByCode();
    return this.stitFields.filter((field) => {
      if (blocked.has(field.code)) return false;
      return pricedCodes.has(String(field.code || '').trim().toUpperCase());
    });
  });
  readonly stitPriceByCode = computed(() => {
    const map = new Map<string, number>();
    if (this.isTechnician()) {
      for (const [code, price] of this.editedPrices()) {
        const key = String(code || '').trim().toUpperCase();
        if (!key) continue;
        const value = Number(price);
        if (Number.isFinite(value)) {
          map.set(key, value);
        }
      }
      return map;
    }
    for (const item of this.items()) {
      const code = String(item.code || '').trim().toUpperCase();
      if (!code) continue;
      const price = Number(item.unitPrice);
      if (Number.isFinite(price)) {
        map.set(code, price);
      }
    }
    return map;
  });
  readonly canViewStitRef = computed(() => {
    const role = this.auth.getUserRole();
    return role === Role.ADMIN || role === Role.DIRIGEANT || role === Role.TECHNICIEN;
  });
  readonly canDownloadStitPdf = computed(() => {
    const role = this.auth.getUserRole();
    return role === Role.ADMIN || role === Role.DIRIGEANT;
  });
  readonly confirmOpen = signal(false);
  readonly confirmAction = signal<ConfirmAction | null>(null);
  readonly confirmContext = signal<
    | { action: 'saveSelection'; technicianLabel?: string | null }
    | { action: 'updatePeriod' }
    | { action: 'addPrestation'; prestation: string; code: string; unitPrice: number }
    | { action: 'updateCode'; id: string; prestation: string; currentCode: string; nextCode: string }
    | { action: 'deletePersonalized'; ownerId: string; technicianLabel: string; selectionId: string }
    | null
  >(null);
  techInitials(tech: User): string {
    const first = String(tech.firstName || '').trim();
    const last = String(tech.lastName || '').trim();
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    if (last) return last.slice(0, 2).toUpperCase();
    return '?';
  }

  readonly selectedTechnicianLabel = computed(() => {
    const id = this.selectedTechnicianId();
    if (!id) return null;
    const match = this.technicians().find((user) => user._id === id);
    if (!match) return 'Technicien sélectionné';
    const parts = [match.firstName, match.lastName].filter(Boolean);
    return parts.length ? parts.join(' ') : match.email || 'Technicien sélectionné';
  });
  readonly activePersonalizedTechnicians = computed(() => {
    const ids = this.personalizedOwnerIds();
    if (!ids.size) return [];
    return this.technicians().filter((tech) => ids.has(tech._id) && tech.authEnabled !== false);
  });
  readonly attachedSegmentTechnicians = computed(() => {
    const segment = this.currentSegment();
    if (segment === 'PERSONNALISE') {
      return this.activePersonalizedTechnicians();
    }
    const segmentMap = this.technicianSegments();
    return this.technicians().filter((tech) => {
      if (tech.authEnabled === false) return false;
      return segmentMap.get(tech._id) === segment;
    });
  });
  readonly isPersonalized = computed(() => {
    if (this.isTechnician()) return true;
    return this.selectedTechnicianId() !== null;
  });
  readonly contextModeLabel = computed(() => {
    if (this.isTechnician()) return 'BPU effectif technicien';
    return this.isPersonalized() ? 'BPU personnalisé' : 'BPU par défaut';
  });
  readonly segmentLabel = computed(() => {
    return SEGMENT_LABELS[this.currentSegment()];
  });
  readonly contextSummary = computed(() => {
    if (this.isTechnician()) {
      return 'Vue lecture seule du BPU réellement appliqué à votre activité.';
    }
    const target = this.selectedTechnicianLabel() || 'BPU par défaut';
    if (this.isPersonalized()) {
      return `Vous modifiez le ${this.contextModeLabel()} de ${target}.`;
    }
    return `Vous modifiez le ${this.contextModeLabel()} du segment ${this.segmentLabel()}.`;
  });

  readonly sortedItems = computed(() => {
    const dir = this.sortDir();
    const factor = dir === 'asc' ? 1 : -1;
    const items = [...this.items()];
    items.sort((a, b) => factor * String(a.prestation || '').localeCompare(String(b.prestation || '')));
    return items;
  });

  constructor() {
    this.initFromQueryParams();
    if (!this.isTechnician()) {
      this.loadTechnicians();
    }
    this.load();
  }

  loadTechnicians(): void {
    if (this.isTechnician()) return;
    this.techniciansLoading.set(true);
    this.techniciansError.set(null);
    forkJoin({
      users: this.userService.refreshUsers(true, { role: Role.TECHNICIEN, limit: 1000 }),
      employees: this.hrService.listEmployees({ role: Role.TECHNICIEN, limit: 1000 })
    }).subscribe({
      next: ({ users, employees }) => {
        const list = [...(users?.items || [])];
        list.sort((a, b) => {
          const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
          const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        const segmentMap = new Map<string, Segment>();
        for (const entry of employees?.items || []) {
          const user = entry.user;
          const id = String(user?._id || '').trim();
          if (!id) continue;
          segmentMap.set(id, this.segmentFromContractType(entry.profile?.contractType));
        }
        this.technicians.set(list);
        this.technicianSegments.set(segmentMap);
        this.techniciansLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.techniciansError.set(apiError(err, 'Erreur chargement techniciens'));
        this.techniciansLoading.set(false);
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.warning.set(null);
    const segment = this.currentSegment();
    const items$ = this.listItemsForSegment(segment);
    const selectedOwner = this.isTechnician() ? null : this.selectedTechnicianId();
    const selections$ = this.isTechnician()
      ? this.bpuSelectionService.list()
      : selectedOwner
        ? forkJoin({
            owner: this.bpuSelectionService.list({ owner: selectedOwner }),
            global: this.bpuSelectionService.list(),
            personalized: this.bpuSelectionService.list({ owner: 'all' })
          })
        : forkJoin({
            global: this.bpuSelectionService.list(),
            personalized: this.bpuSelectionService.list({ owner: 'all' })
          });

    forkJoin({
      items: items$,
      selections: selections$
    }).subscribe({
      next: ({ items, selections }) => {
        const selectionPayload = selections as BpuSelection[]
          | { owner: BpuSelection[]; global: BpuSelection[]; personalized?: BpuSelection[] }
          | { global: BpuSelection[]; personalized?: BpuSelection[] };
        const selectionsOwner: BpuSelection[] = Array.isArray(selectionPayload)
          ? selectionPayload
          : ('owner' in selectionPayload ? selectionPayload.owner : selectionPayload.global);
        const selectionsGlobal: BpuSelection[] = Array.isArray(selectionPayload)
          ? selectionPayload
          : selectionPayload.global;
        const selection = this.isTechnician()
          ? this.resolveSelection(selectionsOwner, selectionsOwner, segment)
          : this.resolveSelection(selectionsOwner, selectionsGlobal, segment);
        const isErtCatalog = !this.isTechnician() && !selectedOwner && segment === 'ERT';
        const uniqueItems = this.uniqueItems(items);
        const allowedCodes = this.isTechnician()
          ? new Set((selection?.prestations || [])
              .map((p) => String(p.code || '').trim().toUpperCase())
              .filter(Boolean))
          : null;
        const visibleItems = this.isTechnician()
          ? uniqueItems.filter((item) => {
              const code = String(item.code || '').trim().toUpperCase();
              if (this.isCablePavCode(item.code)) return false;
              if (!allowedCodes || !allowedCodes.size) return false;
              return allowedCodes.has(code);
            })
          : uniqueItems;
        this.items.set(visibleItems);
        this.editedCodes.set(this.buildEditedCodesMap(visibleItems));
        if (!this.isTechnician()) {
          const ownerIds = new Set<string>();
          const ownerSelections = new Map<string, BpuSelection>();
          const personalized = Array.isArray(selectionPayload)
            ? []
            : (selectionPayload.personalized || []);
          for (const entry of personalized) {
            if (!entry?.owner) continue;
            const entryType = this.normalizeSelectionType(entry.type);
            if (entryType === 'DEFAULT_RATES') continue;
            const ownerId = String(entry.owner);
            ownerIds.add(ownerId);
            const current = ownerSelections.get(ownerId);
            if (!current) {
              ownerSelections.set(ownerId, entry);
              continue;
            }
            const currentType = this.normalizeSelectionType(current.type);
            if (currentType !== 'PERSONNALISE' && entryType === 'PERSONNALISE') {
              ownerSelections.set(ownerId, entry);
              continue;
            }
            if (currentType !== 'PERSONNALISE' && currentType !== entryType) {
              ownerSelections.set(ownerId, entry);
            }
          }
          this.personalizedOwnerIds.set(ownerIds);
          this.personalizedSelectionByOwner.set(ownerSelections);
        }
        const selectionState = this.buildSelectionState(visibleItems, selection, isErtCatalog);
        this.selectedCodes.set(selectionState.selected);
        this.editedPrices.set(selectionState.edited);
        if (isErtCatalog && !items.length) {
          this.warning.set('Le segment BPU ERT est vide. Le catalogue de base est affiché pour initialiser le référentiel ERT.');
        }
        this.loading.set(false);
        this.loadHistory();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiError(err, 'Erreur chargement BPU'));
        this.loading.set(false);
      }
    });
  }

  loadHistory(): void {
    if (this.isTechnician()) return;
    this.historyLoading.set(true);
    const owner = this.selectedTechnicianId() || null;
    this.bpuSelectionService.listHistory({ owner }).subscribe({
      next: (history) => {
        this.priceHistory.set(history || []);
        this.historyLoading.set(false);
        // Auto-expand le snapshot le plus récent en mode PERSONNALISÉ
        if (this.currentSegment() === 'PERSONNALISE' && this.selectedTechnicianId() && history?.length) {
          const firstId = history[0]._id;
          if (firstId) this.toggleHistoryEntry(firstId);
        }
      },
      error: () => {
        this.priceHistory.set([]);
        this.historyLoading.set(false);
      }
    });
  }

  toggleHistoryEntry(id: string): void {
    const next = this.historyExpanded() === id ? null : id;
    this.historyExpanded.set(next);
    if (next) {
      const entry = this.priceHistory().find(e => e._id === next);
      const priceMap = new Map<string, number>();
      const codeSet = new Set<string>();
      for (const p of entry?.prestations ?? []) {
        const code = String(p.code || '').trim().toUpperCase();
        priceMap.set(code, Number(p.unitPrice ?? 0));
        codeSet.add(code);
      }
      this.editedPeriodPrices.set(priceMap);
      this.editedPeriodCodes.set(codeSet);
    } else {
      this.editedPeriodPrices.set(new Map());
      this.editedPeriodCodes.set(new Set());
    }
  }

  historyEntryDate(entry: BpuPriceHistory): string {
    const d = new Date(entry.validFrom);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  deleteHistoryEntry(entry: BpuPriceHistory, event: Event): void {
    event.stopPropagation();
    const id = entry._id;
    if (!id) return;
    const next = new Set(this.historyDeleting());
    next.add(id);
    this.historyDeleting.set(next);
    this.bpuSelectionService.deleteHistory(id).subscribe({
      next: () => {
        this.priceHistory.set(this.priceHistory().filter(e => e._id !== id));
        if (this.historyExpanded() === id) {
          this.historyExpanded.set(null);
          this.editedPeriodPrices.set(new Map());
        }
        const s = new Set(this.historyDeleting());
        s.delete(id);
        this.historyDeleting.set(s);
      },
      error: () => {
        const s = new Set(this.historyDeleting());
        s.delete(id);
        this.historyDeleting.set(s);
        this.error.set('Erreur lors de la suppression du snapshot.');
      }
    });
  }

  isHistoryDeleting(entry: BpuPriceHistory): boolean {
    return !!entry._id && this.historyDeleting().has(entry._id);
  }

  isInPeriodView(): boolean {
    return this.activePeriodMap() !== null;
  }

  /** Prix du snapshot actif pour un item ; null si pas de snapshot ou code absent */
  periodPrice(item: BpuEntry): number | null {
    const map = this.activePeriodMap();
    if (!map) return null;
    const key = String(item.code || '').trim().toUpperCase();
    const val = map.get(key);
    return val !== undefined ? val : null;
  }

  togglePeriodCode(code: string): void {
    const key = String(code || '').trim().toUpperCase();
    if (!key) return;
    const next = new Set(this.editedPeriodCodes());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      if (!this.editedPeriodPrices().has(key)) {
        const ertItem = this.items().find(i => String(i.code || '').trim().toUpperCase() === key);
        if (ertItem) {
          const prices = new Map(this.editedPeriodPrices());
          prices.set(key, Number(ertItem.unitPrice || 0));
          this.editedPeriodPrices.set(prices);
        }
      }
    }
    this.editedPeriodCodes.set(next);
  }

  isPeriodCodeSelected(code: string): boolean {
    return this.editedPeriodCodes().has(String(code || '').trim().toUpperCase());
  }

  onPeriodPriceChange(item: BpuEntry, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const key = String(item.code || '').trim().toUpperCase();
    if (!key) return;
    const raw = target.value.trim();
    const next = new Map(this.editedPeriodPrices());
    if (raw === '') {
      // Champ vidé : retirer de la map (ne pas enregistrer)
      next.delete(key);
    } else {
      const value = Number(raw);
      next.set(key, Number.isFinite(value) ? value : 0);
    }
    this.editedPeriodPrices.set(next);
  }

  /** true si le code est dans le snapshot original (présent à l'ouverture de la période) */
  isInOriginalSnapshot(item: BpuEntry): boolean {
    const id = this.historyExpanded();
    if (!id) return false;
    const entry = this.priceHistory().find(e => e._id === id);
    if (!entry) return false;
    const key = String(item.code || '').trim().toUpperCase();
    return entry.prestations.some(p => String(p.code || '').trim().toUpperCase() === key);
  }

  hasPeriodChanges(): boolean {
    const id = this.historyExpanded();
    if (!id) return false;
    const entry = this.priceHistory().find(e => e._id === id);
    if (!entry) return false;

    const originalCodes = new Set<string>();
    const originalPrices = new Map<string, number>();
    for (const p of entry.prestations) {
      const key = String(p.code || '').trim().toUpperCase();
      originalCodes.add(key);
      originalPrices.set(key, Number(p.unitPrice ?? 0));
    }

    const editedCodes = this.editedPeriodCodes();
    const editedPrices = this.editedPeriodPrices();

    if (editedCodes.size !== originalCodes.size) return true;
    for (const code of editedCodes) {
      if (!originalCodes.has(code)) return true;
    }
    for (const [code, price] of editedPrices) {
      if (originalCodes.has(code) && originalPrices.get(code) !== price) return true;
    }

    return false;
  }

  requestUpdatePeriod(): void {
    this.openConfirm('updatePeriod', { action: 'updatePeriod' });
  }

  private performUpdatePeriod(): void {
    const id = this.historyExpanded();
    if (!id) return;
    const codes = this.editedPeriodCodes();
    const prices = this.editedPeriodPrices();
    const prestations = Array.from(codes)
      .map(code => ({ code, unitPrice: prices.get(code) ?? 0 }))
      .filter(p => p.code && Number.isFinite(p.unitPrice));
    if (!prestations.length) {
      this.error.set('Sélectionnez au moins une prestation.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.bpuSelectionService.updateHistory(id, prestations).subscribe({
      next: (updated) => {
        this.priceHistory.set(
          this.priceHistory().map(e => e._id === id ? { ...e, prestations: updated.prestations } : e)
        );
        const newPrices = new Map<string, number>();
        const newCodes = new Set<string>();
        for (const p of updated.prestations) {
          const code = String(p.code || '').trim().toUpperCase();
          newPrices.set(code, Number(p.unitPrice ?? 0));
          newCodes.add(code);
        }
        this.editedPeriodPrices.set(newPrices);
        this.editedPeriodCodes.set(newCodes);
        this.success.set('Snapshot mis à jour avec succès.');
        this.saving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiError(err, 'Erreur mise à jour du snapshot'));
        this.saving.set(false);
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
    this.syncQueryParams();
    this.load();
  }

  onTechnicianChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    const value = target.value || '';
    const nextValue = value.trim() ? value : null;
    const previous = this.selectedTechnicianId();
    if (nextValue === previous) return;
    this.selectedTechnicianId.set(nextValue);
    if (previous && !nextValue) {
      this.warning.set('Retour au BPU global. Les modifications seront appliquées au global.');
    }
    this.selectedCodes.set(new Set());
    this.editedPrices.set(new Map());
    this.syncQueryParams();
    this.load();
  }

  onNewPrestationChange(field: 'prestation' | 'code' | 'unitPrice', event: Event): void {
    if (this.isTechnician()) return;
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const current = this.newPrestation();
    if (field === 'unitPrice') {
      const value = Number(target.value);
      this.newPrestation.set({ ...current, unitPrice: Number.isFinite(value) ? value : 0 });
      return;
    }
    this.newPrestation.set({ ...current, [field]: target.value });
  }

  onNewPrestationKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (this.adding() || this.loading() || this.saving()) return;
    if (this.canAddPrestation()) {
      this.addPrestation();
    }
  }

  canAddPrestation(): boolean {
    if (this.isTechnician()) return false;
    const draft = this.newPrestation();
    const prestation = String(draft.prestation || '').trim();
    const code = String(draft.code || '').trim();
    return prestation.length >= 2 && code.length >= 2 && Number.isFinite(Number(draft.unitPrice));
  }

  addPrestation(): void {
    if (!this.canAddPrestation()) {
      this.error.set('Veuillez renseigner une prestation, un code et un prix valides.');
      return;
    }
    const draft = this.newPrestation();
    this.openConfirm('addPrestation', {
      action: 'addPrestation',
      prestation: String(draft.prestation || '').trim(),
      code: String(draft.code || '').trim().toUpperCase(),
      unitPrice: Number(draft.unitPrice || 0)
    });
  }

  copyFromGlobal(): void {
    if (this.isTechnician() || !this.selectedTechnicianId()) return;
    this.loading.set(true);
    this.error.set(null);
    const segment = this.currentSegment();
    const items$ = this.listItemsForSegment(segment);
    forkJoin({
      items: items$,
      selections: this.bpuSelectionService.list()
    }).subscribe({
      next: ({ items, selections }) => {
        const uniqueItems = this.uniqueItems(items);
        this.items.set(uniqueItems);
        this.editedCodes.set(this.buildEditedCodesMap(uniqueItems));
        const selection = this.resolveSelection(selections, selections, segment);
        const selectionState = this.buildSelectionState(uniqueItems, selection);
        this.selectedCodes.set(selectionState.selected);
        this.editedPrices.set(selectionState.edited);
        this.loading.set(false);
        this.success.set(`BPU global copié. Vous pouvez ajuster avant d'enregistrer.`);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiError(err, 'Erreur chargement BPU'));
        this.loading.set(false);
      }
    });
  }

  toggleSortPrestation(): void {
    this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
  }

  codeValue(item: BpuEntry): string {
    const id = item._id;
    if (!id) return String(item.code || '');
    const current = this.editedCodes().get(id);
    return current ?? String(item.code || '');
  }

  onCodeInput(item: BpuEntry, event: Event): void {
    if (this.isTechnician()) return;
    const id = item._id;
    const target = event.target as HTMLInputElement | null;
    if (!id || !target) return;
    const value = String(target.value || '').trim().toUpperCase();
    const next = new Map(this.editedCodes());
    next.set(id, value);
    this.editedCodes.set(next);
    this.success.set(null);
  }

  commitCode(item: BpuEntry): void {
    if (this.isTechnician()) return;
    const id = item._id;
    if (!id) return;
    const nextCode = this.codeValue(item).trim().toUpperCase();
    const currentCode = String(item.code || '').trim().toUpperCase();
    if (!nextCode || nextCode === currentCode) {
      const next = new Map(this.editedCodes());
      next.set(id, currentCode);
      this.editedCodes.set(next);
      return;
    }
    this.openConfirm('updateCode', {
      action: 'updateCode',
      id,
      prestation: item.prestation,
      currentCode,
      nextCode
    });
  }

  isCodeSaving(item: BpuEntry): boolean {
    const id = item._id;
    return !!id && this.savingCodes().has(id);
  }

  confirmTitle(): string {
    const action = this.confirmAction();
    if (action === 'addPrestation') return `Confirmer l'ajout`;
    if (action === 'updateCode') return 'Confirmer la modification';
    if (action === 'deletePersonalized') return 'Confirmer la suppression du BPU personnalisé';
    if (action === 'updatePeriod') return 'Modifier les prix de la période';
    return 'Confirmer la validation';
  }

  confirmSubtitle(): string {
    const action = this.confirmAction();
    const context = this.confirmContext();
    if (action === 'addPrestation' && context?.action === 'addPrestation') {
      return `La prestation ${context.prestation} sera ajoutée au BPU.`;
    }
    if (action === 'updateCode' && context?.action === 'updateCode') {
      return `Le code sera modifié de ${context.currentCode} vers ${context.nextCode}.`;
    }
    if (action === 'deletePersonalized' && context?.action === 'deletePersonalized') {
      return `Le BPU personnalisé de ${context.technicianLabel} sera supprimé. Cette action retire sa configuration dédiée et le technicien reviendra sur le BPU par défaut.`;
    }
    if (action === 'updatePeriod') {
      const entry = this.priceHistory().find(e => e._id === this.historyExpanded());
      const date = entry ? this.historyEntryDate(entry) : '';
      return `Les prix du snapshot « Valable à partir du ${date} » seront mis à jour. Cette action est irréversible.`;
    }
    if (action === 'saveSelection' && context?.action === 'saveSelection') {
      if (context.technicianLabel) {
        return `Le BPU de suivi sera sauvegardé pour ${context.technicianLabel}.`;
      }
      return 'Le BPU sera sauvegardé pour vos prestations.';
    }
    return 'Le BPU sera sauvegardé pour vos prestations.';
  }

  confirmButtonLabel(): string {
    const action = this.confirmAction();
    if (action === 'addPrestation') return 'Ajouter';
    if (action === 'updateCode') return 'Modifier';
    if (action === 'deletePersonalized') return 'Supprimer';
    if (action === 'updatePeriod') return 'Mettre à jour';
    return 'Valider';
  }

  confirmTone(): 'primary' | 'success' | 'danger' {
    const action = this.confirmAction();
    if (action === 'updateCode') return 'primary';
    if (action === 'updatePeriod') return 'primary';
    if (action === 'deletePersonalized') return 'danger';
    return 'success';
  }

  confirmBusy(): boolean {
    const action = this.confirmAction();
    if (action === 'addPrestation') return this.adding();
    if (action === 'saveSelection') return this.saving();
    if (action === 'updatePeriod') return this.saving();
    if (action === 'updateCode') {
      const context = this.confirmContext();
      if (context?.action === 'updateCode') {
        return this.savingCodes().has(context.id);
      }
    }
    if (action === 'deletePersonalized') return this.deletingPersonalized();
    return this.saving() || this.adding();
  }

  readonly deletingPersonalized = signal(false);

  editPersonalized(techId: string): void {
    if (!techId) return;
    this.currentSegment.set('PERSONNALISE');
    this.selectedTechnicianId.set(techId);
    this.selectedCodes.set(new Set());
    this.editedPrices.set(new Map());
    this.historyExpanded.set(null);
    this.editedPeriodPrices.set(new Map());
    this.editedPeriodCodes.set(new Set());
    this.syncQueryParams();
    this.load();
  }

  clearSelectedTechnician(): void {
    this.selectedTechnicianId.set(null);
    this.selectedCodes.set(new Set());
    this.editedPrices.set(new Map());
    this.historyExpanded.set(null);
    this.editedPeriodPrices.set(new Map());
    this.editedPeriodCodes.set(new Set());
    this.syncQueryParams();
    this.load();
  }

  setSegment(segment: Segment): void {
    if (segment === this.currentSegment() && !this.selectedTechnicianId()) return;
    this.currentSegment.set(segment);
    if (segment !== 'PERSONNALISE') this.selectedTechnicianId.set(null);
    this.isEditing.set(false);
    this.selectedCodes.set(new Set());
    this.editedPrices.set(new Map());
    this.historyExpanded.set(null);
    this.editedPeriodPrices.set(new Map());
    this.editedPeriodCodes.set(new Set());
    this.syncQueryParams();
    this.load();
  }

  openAttachedTechnician(techId: string): void {
    if (!techId) return;
    if (this.currentSegment() === 'PERSONNALISE') {
      this.editPersonalized(techId);
      return;
    }
    this.selectedTechnicianId.set(techId);
    this.selectedCodes.set(new Set());
    this.editedPrices.set(new Map());
    this.syncQueryParams();
    this.load();
  }

  requestDeletePersonalized(techId: string): void {
    const selection = this.personalizedSelectionByOwner().get(techId);
    if (!selection?._id) {
      this.error.set('Aucun BPU de suivi trouvé pour ce technicien.');
      return;
    }
    const tech = this.technicians().find((t) => t._id === techId);
    const label = tech ? [tech.firstName, tech.lastName].filter(Boolean).join(' ') : 'Technicien';
    this.openConfirm('deletePersonalized', {
      action: 'deletePersonalized',
      ownerId: techId,
      selectionId: selection._id,
      technicianLabel: label
    });
  }

  private performAddPrestation(context: { action: 'addPrestation'; prestation: string; code: string; unitPrice: number } | null): void {
    if (!context) return;
    const payload = {
      segment: this.currentSegment(),
      prestation: String(context.prestation || '').trim(),
      code: String(context.code || '').trim().toUpperCase(),
      unitPrice: Number(context.unitPrice || 0)
    };
    if (!payload.prestation || !payload.code || !Number.isFinite(payload.unitPrice)) {
      this.error.set(`Champs invalides pour l'ajout.`);
      return;
    }

    this.adding.set(true);
    this.error.set(null);
    this.success.set(null);
    this.bpuService.upsert(payload).subscribe({
      next: () => {
        this.adding.set(false);
        this.newPrestation.set({ prestation: '', code: '', unitPrice: 0 });
        this.success.set('Prestation ajoutée.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.adding.set(false);
        this.error.set(apiError(err, 'Erreur ajout prestation'));
      }
    });
  }

  private performUpdateCode(context: { action: 'updateCode'; id: string; prestation: string; currentCode: string; nextCode: string } | null): void {
    if (!context) return;
    const id = context.id;
    const currentCode = context.currentCode;
    const nextCode = context.nextCode;
    if (!id || !nextCode) return;
    const item = this.items().find((entry) => entry._id === id);
    if (!item) return;

    const saving = new Set(this.savingCodes());
    saving.add(id);
    this.savingCodes.set(saving);
    this.error.set(null);

    this.bpuService.updateCode(id, nextCode).subscribe({
      next: (updated) => {
        item.code = updated.code;
        const selected = new Set(this.selectedCodes());
        if (selected.has(currentCode)) {
          selected.delete(currentCode);
          selected.add(updated.code);
          this.selectedCodes.set(selected);
        }
        const prices = new Map(this.editedPrices());
        if (prices.has(currentCode)) {
          const value = prices.get(currentCode) ?? 0;
          prices.delete(currentCode);
          prices.set(updated.code, value);
          this.editedPrices.set(prices);
        }
        const codes = new Map(this.editedCodes());
        codes.set(id, updated.code);
        this.editedCodes.set(codes);
        const nextSaving = new Set(this.savingCodes());
        nextSaving.delete(id);
        this.savingCodes.set(nextSaving);
        this.success.set('Code BPU mis à jour.');
      },
      error: (err: HttpErrorResponse) => {
        const codes = new Map(this.editedCodes());
        codes.set(id, currentCode);
        this.editedCodes.set(codes);
        const nextSaving = new Set(this.savingCodes());
        nextSaving.delete(id);
        this.savingCodes.set(nextSaving);
        this.error.set(apiError(err, 'Erreur mise à jour du code'));
      }
    });
  }

  private performDeletePersonalized(
    context: { action: 'deletePersonalized'; ownerId: string; technicianLabel: string; selectionId: string } | null
  ): void {
    if (!context) return;
    this.deletingPersonalized.set(true);
    this.error.set(null);
    this.success.set(null);
    this.bpuSelectionService.delete(context.selectionId).subscribe({
      next: () => {
        this.deletingPersonalized.set(false);
        if (this.selectedTechnicianId() === context.ownerId) {
          this.selectedTechnicianId.set(null);
        }
        this.success.set('BPU de suivi supprimé.');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deletingPersonalized.set(false);
        this.error.set(apiError(err, 'Erreur suppression BPU'));
      }
    });
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
    if (this.isTechnician()) {
      this.router.navigate(['/technician']).then();
      return;
    }
    this.router.navigate(['/admin/bpu']).then();
  }

  toggleSelection(item: BpuEntry): void {
    if (this.isTechnician()) return;
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
    if (this.isTechnician()) return this.items().length > 0;
    const items = this.items().filter((item) => item.code);
    return items.length > 0 && items.every((item) => this.selectedCodes().has(item.code));
  }

  toggleSelectAll(): void {
    if (this.isTechnician()) return;
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
    if (this.isTechnician()) return this.items().length > 0;
    return this.selectedCodes().size > 0;
  }

  onValidFromChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.selectionValidFrom.set(target?.value ?? '');
  }

  saveSelection(): void {
    if (this.isTechnician()) {
      this.error.set('Vous pouvez consulter votre BPU, mais pas le modifier.');
      return;
    }
    if (!this.hasSelection()) {
      this.error.set('Veuillez sélectionner au moins une prestation.');
      return;
    }
    this.openConfirm('saveSelection', {
      action: 'saveSelection',
      technicianLabel: this.selectedTechnicianLabel()
    });
  }

  closeConfirm(): void {
    const action = this.confirmAction();
    const context = this.confirmContext();
    if (action === 'updateCode' && context?.action === 'updateCode') {
      const id = context.id;
      const currentCode = context.currentCode;
      const next = new Map(this.editedCodes());
      next.set(id, currentCode);
      this.editedCodes.set(next);
    }
    this.confirmOpen.set(false);
    this.confirmAction.set(null);
    this.confirmContext.set(null);
  }

  confirmSave(): void {
    const action = this.confirmAction();
    const context = this.confirmContext();
    this.confirmOpen.set(false);
    this.confirmAction.set(null);
    this.confirmContext.set(null);
    if (!action) return;
    if (action === 'saveSelection') {
      this.performSaveSelection();
      return;
    }
    if (action === 'updatePeriod') {
      this.performUpdatePeriod();
      return;
    }
    if (action === 'addPrestation' && context?.action === 'addPrestation') {
      this.performAddPrestation(context);
      return;
    }
    if (action === 'updateCode' && context?.action === 'updateCode') {
      this.performUpdateCode(context);
      return;
    }
    if (action === 'deletePersonalized' && context?.action === 'deletePersonalized') {
      this.performDeletePersonalized(context);
    }
  }

  private openConfirm(
    action: ConfirmAction,
    context: { action: 'saveSelection'; technicianLabel?: string | null }
      | { action: 'updatePeriod' }
      | { action: 'addPrestation'; prestation: string; code: string; unitPrice: number }
      | { action: 'updateCode'; id: string; prestation: string; currentCode: string; nextCode: string }
      | { action: 'deletePersonalized'; ownerId: string; technicianLabel: string; selectionId: string }
  ): void {
    this.confirmAction.set(action);
    this.confirmContext.set(context);
    this.confirmOpen.set(true);
  }

  private performSaveSelection(): void {
    if (!this.isTechnician() && !this.selectedTechnicianId() && this.currentSegment() === 'ERT') {
      this.performSaveErtCatalog();
      return;
    }
    const isPersonalizedSave = !this.isTechnician() && !!this.selectedTechnicianId();
    const type = this.isTechnician()
      ? 'DEFAULT_RATES'
      : isPersonalizedSave
        ? 'PERSONNALISE'
        : this.currentSegment();
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

    const validFromRaw = this.selectionValidFrom().trim();
    const payload: { type: string; prestations: { code: string; unitPrice: number }[]; owner?: string | null; validFrom?: string } = {
      type,
      prestations
    };
    if (!this.isTechnician() && this.selectedTechnicianId()) {
      payload.owner = this.selectedTechnicianId();
    }
    if (validFromRaw) {
      payload.validFrom = new Date(validFromRaw).toISOString();
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.bpuSelectionService.create(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedCodes.set(new Set());
        const queryParams: Record<string, string> = {
          saved: '1',
          segment: isPersonalizedSave ? 'PERSONNALISE' : this.currentSegment()
        };
        if (!this.isTechnician() && this.selectedTechnicianId()) {
          queryParams['technician'] = this.selectedTechnicianId() as string;
        }
        if (this.isTechnician()) {
          this.router.navigate(['/technician/bpu'], { queryParams }).then();
        } else {
          this.router.navigate(['/admin/bpu'], { queryParams }).then();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(apiError(err, 'Erreur sauvegarde BPU'));
      }
    });
  }

  private performSaveErtCatalog(): void {
    const selected = this.items().filter((item) => item.code && this.selectedCodes().has(item.code));
    const payload = selected
      .map((item) => ({
        prestation: String(item.prestation || '').trim(),
        code: String(item.code || '').trim().toUpperCase(),
        unitPrice: this.priceValue(item)
      }))
      .filter((item) => item.prestation && item.code && Number.isFinite(item.unitPrice));

    if (!payload.length) {
      this.error.set('Veuillez sélectionner au moins une prestation pour initialiser le BPU ERT.');
      return;
    }

    const validFromRaw = this.selectionValidFrom().trim();
    const validFrom = validFromRaw ? new Date(validFromRaw).toISOString() : undefined;

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.bpuService.bulkUpsert('ERT', payload).subscribe({
      next: (res) => {
        // Créer aussi une BpuSelection ERT pour déclencher l'historisation
        const selectionPrestations = payload.map(p => ({ code: p.code, unitPrice: p.unitPrice }));
        this.bpuSelectionService.create({
          type: 'ERT',
          owner: null,
          prestations: selectionPrestations,
          validFrom
        }).subscribe({ error: () => { /* ignoré */ } });

        this.saving.set(false);
        this.selectedCodes.set(new Set());
        const created = Number(res.created || 0);
        const updated = Number(res.updated || 0);
        this.success.set(`BPU ERT enregistré (${created} création(s), ${updated} mise(s) à jour).`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(apiError(err, 'Erreur sauvegarde BPU ERT'));
      }
    });
  }

  exportCsv(): void {
    this.bpuService.exportCsv().subscribe({
      next: (blob) => downloadBlob(blob, 'bpu.csv'),
      error: (err: HttpErrorResponse) => {
        this.error.set(apiError(err, 'Erreur export CSV'));
      }
    });
  }

  exportPdf(): void {
    this.bpuService.exportPdf().subscribe({
      next: (blob) => downloadBlob(blob, 'bpu.pdf'),
      error: (err: HttpErrorResponse) => {
        this.error.set(apiError(err, 'Erreur export PDF'));
      }
    });
  }

  isBluePill(code?: string): boolean {
    const c = code?.toUpperCase();
    // Nouveaux codes BPU STIT 2026
    if (c === 'RACIM' || c === 'RAC_PBO_SOUT' || c === 'RAC_PBO_AERIEN' || c === 'RAC_PBO_FACADE') return true;
    if (c === 'PLV_PRO_S' || c === 'PLV_PRO_C') return true;
    if (c === 'REFRAC' || c === 'REFRAC_DEGRADATION') return true;
    // Rétrocompat anciens codes
    if (c === 'RACPAV' || c === 'RACIH' || c === 'RACPRO_S' || c === 'RACPRO_C' || c === 'REFC_DGR') return true;
    return false;
  }

  isOrangePill(code?: string): boolean {
    return code === 'SAV' || code === 'SAV_EXP';
  }

  isGreenPill(code?: string): boolean {
    const c = code?.toUpperCase();
    if (c === 'PRESTA_COMPL') return true;
    // Codes bonus technicien
    if (c?.startsWith('BONUS_') || c === 'SCORING_TECHNICIEN') return true;
    return false;
  }

  isYellowPill(code?: string): boolean {
    const c = code?.toUpperCase();
    return c === 'RECOIP' || c === 'DEPLACEMENT_PRISE' || c === 'DEPLPRISE';
  }

  isRedText(code?: string): boolean {
    const c = code?.toUpperCase();
    return c === 'PLV_PRO_S' || c === 'PLV_PRO_C' || c === 'RACPRO_S' || c === 'RACPRO_C';
  }

  isAquaPill(code?: string): boolean {
    const c = code?.toUpperCase();
    return c === 'FOURREAU_CASSE_PRIVE' || c === 'FOURREAU_CASSE_BETON' || c === 'REPFOU_PRI' || c === 'DEMO';
  }

  isTurquoisePill(code?: string): boolean {
    return code === 'CLEM';
  }

  isVioletPill(code?: string): boolean {
    const c = code?.toUpperCase();
    // Nouveaux codes câble et matériel
    if (c === 'CABLE_SL' || c === 'BIFIBRE' || c === 'NACELLE') return true;
    // Rétrocompat anciens codes câble pavillon
    if (c === 'CABLE_PAV_1' || c === 'CABLE_PAV_2' || c === 'CABLE_PAV_3' || c === 'CABLE_PAV_4') return true;
    return false;
  }

  isPenaltyPill(code?: string): boolean {
    const c = code?.toUpperCase();
    return (c?.startsWith('PEN_') ?? false) || c === 'SINISTRE';
  }

  stitPrice(code?: string): number | null {
    const key = String(code || '').trim().toUpperCase();
    if (!key) return null;
    return this.stitPriceByCode().get(key) ?? null;
  }


  private isCablePavCode(code?: string): boolean {
    const c = code?.toUpperCase();
    return c === 'CABLE_SL'
      || c === 'CABLE_PAV_1'
      || c === 'CABLE_PAV_2'
      || c === 'CABLE_PAV_3'
      || c === 'CABLE_PAV_4'
      || c === 'CABLE_PAV_SL';
  }

  private resolveSelection(ownerSelections: BpuSelection[], globalSelections: BpuSelection[], segment: Segment): BpuSelection | null {
    const segmentKey = this.normalizeSelectionType(segment);
    const pick = (items: BpuSelection[], type: string) => items.find((item) => this.normalizeSelectionType(item.type) === type);
    const pickAnyOwnerSpecific = (items: BpuSelection[]) =>
      items.find((item) => {
        const type = this.normalizeSelectionType(item.type);
        return !!item?.owner && type !== 'DEFAULT_RATES';
      });
    return (
      pick(ownerSelections, 'PERSONNALISE')
      || (segmentKey === 'PERSONNALISE' ? pickAnyOwnerSpecific(ownerSelections) : null)
      || (segmentKey !== 'PERSONNALISE' ? pick(ownerSelections, segmentKey) : null)
      || pick(ownerSelections, 'DEFAULT_RATES')
      || (segmentKey !== 'PERSONNALISE' ? pick(globalSelections, segmentKey) : null)
      || pick(globalSelections, 'DEFAULT_RATES')
      || null
    );
  }

  private normalizeSelectionType(value: string | null | undefined): string {
    return String(value || '').trim().toUpperCase();
  }

  private isSelectionActiveForSegment(selection: BpuSelection, segment: Segment): boolean {
    const type = this.normalizeSelectionType(selection?.type);
    const segmentKey = this.normalizeSelectionType(segment);
    return type === segmentKey || type === 'DEFAULT_RATES';
  }

  private initFromQueryParams(): void {
    const segment = this.route.snapshot.queryParamMap.get('segment');
    if (this.isSegment(segment)) {
      this.currentSegment.set(segment);
      this.isEditing.set(true);
    }
    const technician = this.route.snapshot.queryParamMap.get('technician');
    if (technician) {
      this.selectedTechnicianId.set(technician);
    }
    if (this.route.snapshot.queryParamMap.get('saved') === '1') {
      this.success.set('BPU enregistré avec succès.');
    }
  }

  private isSegment(value: string | null): value is Segment {
    return value === 'AUTO' || value === 'SALARIE' || value === 'PERSONNALISE' || value === 'AUTRE' || value === 'ERT';
  }

  private listItemsForSegment(_segment: Segment) {
    // ERT est le catalogue de référence pour tous les segments
    return this.bpuService.list('ERT').pipe(
      switchMap((items) => (items.length ? of(items) : this.bpuService.list()))
    );
  }

  private buildEditedCodesMap(items: BpuEntry[]): Map<string, string> {
    const codes = new Map<string, string>();
    for (const entry of items) {
      if (entry._id) {
        codes.set(entry._id, String(entry.code || '').trim().toUpperCase());
      }
    }
    return codes;
  }

  private buildSelectionState(
    items: BpuEntry[],
    selection: BpuSelection | null,
    preserveCatalogPrices = false
  ): { selected: Set<string>; edited: Map<string, number> } {
    const availableCodes = new Set(
      items.map((item) => String(item.code || '').trim().toUpperCase()).filter(Boolean)
    );
    const selected = new Set<string>();
    const edited = new Map<string, number>();
    if (preserveCatalogPrices) {
      for (const item of items) {
        const code = String(item.code || '').trim().toUpperCase();
        const price = Number(item.unitPrice);
        if (!code || !Number.isFinite(price)) continue;
        selected.add(code);
        edited.set(code, price);
      }
      return { selected, edited };
    }
    for (const entry of selection?.prestations || []) {
      const code = String(entry.code || '').trim().toUpperCase();
      if (!code || !availableCodes.has(code)) continue;
      selected.add(code);
      edited.set(code, Number(entry.unitPrice || 0));
    }
    return { selected, edited };
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

  private segmentFromContractType(contractType: string | null | undefined): Segment {
    const contract = String(contractType || '').trim().toUpperCase();
    if (contract === 'PERSONNALISE') return 'PERSONNALISE';
    if (contract === 'FREELANCE') return 'AUTO';
    if (contract === 'AUTRE') return 'AUTRE';
    if (contract === 'ERT') return 'ERT';
    return 'SALARIE';
  }

  private syncQueryParams(): void {
    if (this.isTechnician()) return;
    const queryParams: Record<string, string | null> = {
      segment: this.currentSegment(),
      technician: this.selectedTechnicianId(),
      saved: null
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    }).then();
  }
}
