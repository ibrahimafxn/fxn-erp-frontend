// depotDetail.ts

import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';

import {DepotService} from '../../../core/services/depot.service';
import {UserService} from '../../../core/services/user.service';
import {Consumable, User, Depot, DepotManager, Material, Vehicle} from '../../../core/models';
import {DepotStats} from '../../../core/models/depotStats.model';
import {FrDatePipe} from '../../../core/pipes/fr-date.pipe';
import {MaterialService} from '../../../core/services/material.service';
import {ConsumableService} from '../../../core/services/consumable.service';
import {VehicleService} from '../../../core/services/vehicle.service';

@Component({
  standalone: true,
  selector: 'app-depot-detail',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, FrDatePipe],
  templateUrl: './depot-detail.html',
  styleUrls: ['./depot-detail.scss']
})
export class DepotDetail {

  private materialService = inject(MaterialService);
  private consumableService = inject(ConsumableService);
  private vehicleService = inject(VehicleService);
  private depotService = inject(DepotService);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly managerEditOpen = signal(false);
  readonly managerSaving = signal(false);
  readonly managerError = signal<string | null>(null);

  readonly managerCandidatesLoading = signal(false);
  readonly managerCandidates = signal<User[]>([]);
  readonly selectedManagerId = signal<string | null>(null);


  /* -----------------------------
   * État principal
   * ----------------------------- */
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly depot = signal<Depot | null>(null);

  /* -----------------------------
 * Matériels du dépôt
 * ----------------------------- */
  readonly materialsLoading = signal(false);
  readonly materialsError = signal<string | null>(null);
  readonly materials = signal<Material[]>([]);

  /* -----------------------------
   * Consommables du dépôt
   * ----------------------------- */
  readonly consumablesLoading = signal(false);
  readonly consumablesError = signal<string | null>(null);
  readonly consumables = signal<Consumable[]>([]);

  /* -----------------------------
   * Véhicules du dépôt
   * ----------------------------- */
  readonly vehiclesLoading = signal(false);
  readonly vehiclesError = signal<string | null>(null);
  readonly vehicles = signal<Vehicle[]>([]);

  /* -----------------------------
   * Techniciens du dépôt
   * ----------------------------- */
  readonly techLoading = signal(false);
  readonly techError = signal<string | null>(null);
  readonly technicians = signal<User[]>([]);

  /* -----------------------------
   * KPIs (préparés pour API future)
   * ----------------------------- */
  /** KPIs dynamiques (fallback si stats pas encore chargées) */
  readonly kpis = computed(() => {
    const s = this.stats();
    return {
      materials: s ? String(s.materials) : '—',
      consumables: s ? String(s.consumables) : '—',
      technicians: s ? String(s.technicians) : String(this.technicians().length),
      vehicles: s ? String(s.vehicles) : '—',
    };
  });

  /* -----------------------------
   * ID courant
   * ----------------------------- */
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly stats = signal<DepotStats | null>(null);

  constructor() {
    this.load();
  }

  /* =============================
   * Helpers simples pour template
   * ============================= */

  hasDepot(): boolean {
    return this.depot() !== null;
  }

  depotName(): string {
    return this.depot()?.name ?? '';
  }

  depotCity(): string {
    return this.depot()?.city ?? '';
  }

  depotAddress(): string {
    return this.depot()?.address ?? '';
  }

  depotPhone(): string {
    return this.depot()?.phone ?? '';
  }

  depotCreatedAt(): string | Date | null {
    return this.depot()?.createdAt ?? null;
  }

  /* =============================
   * Manager (sans cast dans HTML)
   * ============================= */

  private managerRaw(): string | DepotManager | null {
    return this.depot()?.managerId ?? null;
  }

  manager(): DepotManager | null {
    const m = this.managerRaw();
    return m && typeof m === 'object' ? m : null;
  }

  managerLabel(): string {
    const m = this.manager();
    if (!m) return '—';

    const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim();
    return name || m.email || '—';
  }

  managerEmail(): string {
    return this.manager()?.email ?? '';
  }

  managerAvatar(): string {
    const m = this.manager();
    if (!m) return '—';
    return `${(m.firstName?.[0] ?? '')}${(m.lastName?.[0] ?? '')}`.toUpperCase();
  }

  /* =============================
   * Chargement principal
   * ============================= */
  load(): void {
    if (!this.id) {
      this.error.set('ID dépôt manquant dans l’URL');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.depotService.getDepot(this.id).subscribe({
      next: depot => {
        this.depot.set(depot);
        this.loading.set(false);

        // existant
        this.loadTechnicians(depot._id);
        this.loadVehicles(depot._id); // ✅ AJOUT
        this.loadStats(depot._id);

        if (!this.id) {
          this.error.set('ID dépôt manquant dans l’URL');
          return;
        }

        this.loading.set(true);
        this.error.set(null);

        this.depotService.getDepot(this.id).subscribe({
          next: depot => {
            this.depot.set(depot);
            this.loading.set(false);

            // existant
            this.loadTechnicians(depot._id);

            // ✅ nouveaux
            this.loadMaterials(depot._id);
            this.loadConsumables(depot._id);
            this.loadVehicles(depot._id);

            // stats si tu as déjà
            this.loadStats(depot._id);
          },
          error: err => {
            this.loading.set(false);
            this.error.set(err?.error?.message || 'Erreur chargement dépôt');
          }
        });

        // ✅ nouveaux chargements
        this.loadMaterials(depot._id);
        this.loadConsumables(depot._id);
        this.loadVehicles(depot._id);

        // si tu as stats:
        this.loadStats(depot._id);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement dépôt');
      }
    });
  }

  // -----------------------------
  // LOAD MATERIELS (paginé)
  // -----------------------------
  private loadMaterials(depotId: string): void {
    this.materialsLoading.set(true);
    this.materialsError.set(null);

    this.materialService.refresh(true, {depot: depotId, page: 1, limit: 50}).subscribe({
      next: (res) => {
        this.materials.set(res.items ?? []);
        this.materialsLoading.set(false);
      },
      error: (err) => {
        this.materialsLoading.set(false);
        this.materialsError.set(err?.error?.message || 'Erreur chargement matériels');
      }
    });
  }

  // -----------------------------
  // LOAD CONSOMMABLES (paginé)
  // -----------------------------
  private loadConsumables(depotId: string): void {
    this.consumablesLoading.set(true);
    this.consumablesError.set(null);

    // ✅ Ton service consumable renvoie un result paginé (comme tu l’as fait)
    this.consumableService.refresh(true, {depot: depotId, page: 1, limit: 50}).subscribe({
      next: (res) => {
        this.consumables.set(res.items ?? []);
        this.consumablesLoading.set(false);
      },
      error: (err) => {
        this.consumablesLoading.set(false);
        this.consumablesError.set(err?.error?.message || 'Erreur chargement consommables');
      }
    });
  }

  // -----------------------------
  // LOAD VEHICULES (tableau direct backend)
  // -----------------------------
  private loadVehicles(depotId: string): void {
    this.vehiclesLoading.set(true);
    this.vehiclesError.set(null);

    this.vehicleService.refresh(true, {
      depot: depotId,
      page: 1,
      limit: 50
    }).subscribe({
      next: (res) => {
        this.vehicles.set(res.items ?? []);
        this.vehiclesLoading.set(false);
      },
      error: (err) => {
        this.vehiclesLoading.set(false);
        this.vehiclesError.set(err?.error?.message || 'Erreur chargement véhicules');
      }
    });
  }

  /* -----------------------------
 * Helpers UI (évite filter(Boolean) dans HTML)
 * ----------------------------- */
  vehicleLabel(v: Vehicle): string {
    const brand = (v.brand ?? '').trim();
    const model = (v.model ?? '').trim();
    const text = `${brand} ${model}`.trim();
    return text || '—';
  }

  vehiclePlate(v: Vehicle): string {
    return (v.plateNumber ?? '').trim() || '—';
  }

  vehicleYear(v: Vehicle): string {
    return typeof v.year === 'number' && Number.isFinite(v.year) ? String(v.year) : '—';
  }

  // Dans le cas "au dépôt", assignedTo devrait être null,
  // mais on garde une protection.
  vehicleState(v: Vehicle): 'AU_DEPOT' | 'ASSIGNE' {
    return v.assignedTo ? 'ASSIGNE' : 'AU_DEPOT';
  }

  /** ✅ Convertit ce que renvoie VehicleService (any[]) en Vehicle[] sans `any` dans ce composant */
  private toVehicles(value: unknown): Vehicle[] {
    if (!Array.isArray(value)) return [];
    const out: Vehicle[] = [];

    for (const it of value) {
      const v = this.parseVehicle(it);
      if (v) out.push(v);
    }
    return out;
  }

  private parseVehicle(it: unknown): Vehicle | null {
    if (!it || typeof it !== 'object') return null;

    // lecture safe via Record<string, unknown>
    const o = it as Record<string, unknown>;
    const _id = typeof o['_id'] === 'string' ? o['_id'] : '';
    if (!_id) return null;

    const plateNumber = typeof o['plateNumber'] === 'string'
      ? o['plateNumber']
      : (typeof o['plate'] === 'string' ? o['plate'] : undefined); // compat si backend = plate

    const brand = typeof o['brand'] === 'string' ? o['brand'] : undefined;
    const model = typeof o['model'] === 'string' ? o['model'] : undefined;
    const assignedTo = typeof o['assignedTo'] === 'string' ? o['assignedTo'] : undefined;
    const idDepot = typeof o['idDepot'] === 'string' ? o['idDepot'] : undefined;

    return {
      _id,
      plateNumber,
      brand,
      model,
      assignedTo,
      idDepot,
      createdAt: typeof o['createdAt'] === 'string' || o['createdAt'] instanceof Date ? (o['createdAt'] as string | Date) : undefined,
      updatedAt: typeof o['updatedAt'] === 'string' || o['updatedAt'] instanceof Date ? (o['updatedAt'] as string | Date) : undefined,
    };
  }

  // -----------------------------
  // UI actions
  // -----------------------------
  openAllMaterials(): void {
    this.router.navigate(['/admin/resources/materials'], {queryParams: {depot: this.id}});
  }

  openAllConsumables(): void {
    this.router.navigate(['/admin/resources/consumables'], {queryParams: {depot: this.id}});
  }

  openAllVehicles(): void {
    this.router.navigate(['/admin/resources/vehicles'], {queryParams: {depot: this.id}});
  }

  editMaterial(m: Material): void {
    this.router.navigate(['/admin/resources/materials', m._id, 'edit']);
  }

  editConsumable(c: Consumable): void {
    this.router.navigate(['/admin/resources/consumables', c._id, 'edit']);
  }

  // pas de détail véhicule encore -> on garde simple
  openVehicle(v: Vehicle): void {
    this.router.navigate(['/admin/resources/vehicles'], {queryParams: {depot: this.id}});
  }

  // -----------------------------
  // Labels (lisibles et utiles)
  // -----------------------------
  materialQtyLabel(m: Material): string {
    const q = typeof m.quantity === 'number' ? m.quantity : 0;
    const a = typeof m.assignedQuantity === 'number' ? m.assignedQuantity : 0;
    const free = Math.max(0, q - a);
    return `stock ${q} • attribué ${a} • dispo ${free}`;
  }

  consumableQtyLabel(c: Consumable): string {
    const q = typeof c.quantity === 'number' ? c.quantity : 0;
    const a = typeof c.assignedQuantity === 'number' ? c.assignedQuantity : 0;
    const free = Math.max(0, q - a);
    return `stock ${q} • réservé ${a} • dispo ${free}`;
  }

  /* =============================
   * Chargement techniciens
   * ============================= */

  private loadTechnicians(depotId: string): void {
    this.techLoading.set(true);
    this.techError.set(null);

    this.userService.refreshUsers(true, {
      depot: depotId,
      role: 'TECHNICIEN',
      page: 1,
      limit: 50
    }).subscribe({
      next: result => {
        this.technicians.set(result.items ?? []);
        this.techLoading.set(false);
      },
      error: err => {
        this.techLoading.set(false);
        this.techError.set(err?.error?.message || 'Erreur chargement techniciens');
      }
    });
  }

  /* =============================
   * Navigation
   * ============================= */

  back(): void {
    this.router.navigate(['/admin/depots']);
  }

  edit(): void {
    this.router.navigate(['/admin/depots', this.id, 'edit']);
  }

  /* =============================
   * Manager Edit
   * ============================= */

  openManagerEdit(): void {
    this.managerEditOpen.set(true);
    this.managerError.set(null);

    // managerId peut être string (ObjectId) OU objet peuplé (DepotManager)
    const raw = this.depot()?.managerId ?? null;
    const currentId =
      raw && typeof raw === 'object' ? raw._id : (typeof raw === 'string' ? raw : null);

    this.selectedManagerId.set(currentId);

    // charge candidats (on part sur GESTION_DEPOT uniquement)
    this.loadManagerCandidates();
  }

  closeManagerEdit(): void {
    this.managerEditOpen.set(false);
    this.managerError.set(null);
  }

  onManagerSelect(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    this.selectedManagerId.set(value ? value : null);
  }

  private loadManagerCandidates(): void {
    this.managerCandidatesLoading.set(true);
    this.managerError.set(null);

    this.userService.refreshUsers(true, {
      role: 'GESTION_DEPOT',
      page: 1,
      limit: 100
    }).subscribe({
      next: result => {
        this.managerCandidates.set(result.items ?? []);
        this.managerCandidatesLoading.set(false);
      },
      error: err => {
        this.managerCandidatesLoading.set(false);
        this.managerError.set(err?.error?.message || 'Erreur chargement des gestionnaires');
      }
    });
  }

  saveManager(): void {
    const depotId = this.depot()?._id ?? '';
    if (!depotId) return;

    this.managerSaving.set(true);
    this.managerError.set(null);

    this.depotService.assignManager(depotId, this.selectedManagerId()).subscribe({
      next: updated => {
        this.depot.set(updated);
        this.managerSaving.set(false);
        this.managerEditOpen.set(false);
      },
      error: err => {
        this.managerSaving.set(false);
        this.managerError.set(err?.error?.message || 'Erreur assignation gestionnaire');
      }
    });
  }

  removeManager(): void {
    this.selectedManagerId.set(null);
    this.saveManager();
  }


  modifierConsumable(c: Consumable): void {
    this.router.navigate(['/admin/resources/consumables', c._id, 'edit']);
    // ou ouvrir un modal plus tard
  }

  private loadStats(depotId: string): void {
    this.depotService.getDepotStats(depotId).subscribe({
      next: s => this.stats.set(s),
      error: () => this.stats.set(null),
    });
  }

  protected readonly Boolean = Boolean;
}
