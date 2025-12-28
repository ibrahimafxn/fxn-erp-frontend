// admin/depots/depot-detail/depot-detail.ts
// Drop-in complet et commenté (Angular Signals + services paginés)

import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { DepotService } from '../../../core/services/depot.service';
import { UserService } from '../../../core/services/user.service';
import { MaterialService } from '../../../core/services/material.service';
import { ConsumableService } from '../../../core/services/consumable.service';
import { VehicleService } from '../../../core/services/vehicle.service';

import { FrDatePipe } from '../../../core/pipes/fr-date.pipe';

import { Consumable, User, Depot, DepotManager, Material, Vehicle } from '../../../core/models';
import { DepotStats } from '../../../core/models/depotStats.model';
import {DetailBack} from '../../../core/utils/detail-back';

@Component({
  standalone: true,
  selector: 'app-depot-detail',
  providers: [DatePipe],
  imports: [CommonModule, RouterModule, FrDatePipe],
  templateUrl: './depot-detail.html',
  styleUrls: ['./depot-detail.scss'],
})
export class DepotDetail extends DetailBack{
  // -----------------------------
  // DI
  // -----------------------------
  private materialService = inject(MaterialService);
  private consumableService = inject(ConsumableService);
  private vehicleService = inject(VehicleService);
  private depotService = inject(DepotService);
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);

  // -----------------------------
  // ID courant (route: /admin/depots/:id)
  // -----------------------------
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  // -----------------------------
  // État principal
  // -----------------------------
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly depot = signal<Depot | null>(null);

  // -----------------------------
  // KPIs / Stats
  // -----------------------------
  readonly stats = signal<DepotStats | null>(null);

  /**
   * KPIs dynamiques :
   * - si stats API dispo => utilise stats
   * - sinon fallback : techniciens length / autres = '—'
   */
  readonly kpis = computed(() => {
    const s = this.stats();
    return {
      materials: s ? String((s as any).materials ?? s.materials ?? '—') : '—',
      consumables: s ? String((s as any).consumables ?? s.consumables ?? '—') : '—',
      technicians: s ? String((s as any).technicians ?? s.technicians ?? this.technicians().length) : String(this.technicians().length),
      vehicles: s ? String((s as any).vehicles ?? s.vehicles ?? '—') : '—',
    };
  });

  // -----------------------------
  // Matériels du dépôt
  // -----------------------------
  readonly materialsLoading = signal(false);
  readonly materialsError = signal<string | null>(null);
  readonly materials = signal<Material[]>([]);

  // -----------------------------
  // Consommables du dépôt
  // -----------------------------
  readonly consumablesLoading = signal(false);
  readonly consumablesError = signal<string | null>(null);
  readonly consumables = signal<Consumable[]>([]);

  // -----------------------------
  // Véhicules du dépôt
  // -----------------------------
  readonly vehiclesLoading = signal(false);
  readonly vehiclesError = signal<string | null>(null);
  readonly vehicles = signal<Vehicle[]>([]);

  // -----------------------------
  // Techniciens du dépôt
  // -----------------------------
  readonly techLoading = signal(false);
  readonly techError = signal<string | null>(null);
  readonly technicians = signal<User[]>([]);

  // -----------------------------
  // Manager Edit UI
  // -----------------------------
  readonly managerEditOpen = signal(false);
  readonly managerSaving = signal(false);
  readonly managerError = signal<string | null>(null);

  readonly managerCandidatesLoading = signal(false);
  readonly managerCandidates = signal<User[]>([]);
  readonly selectedManagerId = signal<string | null>(null);

  constructor() {
    super();
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
    // backend: managerId peut être string ObjectId OU objet populate
    return (this.depot()?.managerId as unknown as string | DepotManager | null) ?? null;
  }

  manager(): DepotManager | null {
    const m = this.managerRaw();
    return m && typeof m === 'object' ? (m as DepotManager) : null;
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

  /**
   * Charge:
   * 1) dépôt
   * 2) puis toutes les listes liées (techniciens, matériels, consommables, véhicules, stats)
   */
  load(): void {
    if (!this.id) {
      this.error.set('ID dépôt manquant dans l’URL');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.depotService.getDepot(this.id).subscribe({
      next: (d) => {
        this.depot.set(d);
        this.loading.set(false);

        // Charge toutes les ressources rattachées
        const depotId = d._id;

        this.loadTechnicians(depotId);
        this.loadMaterials(depotId);
        this.loadConsumables(depotId);
        this.loadVehicles(depotId);
        this.loadStats(depotId);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement dépôt');
      },
    });
  }

  /* =============================
   * LOAD : Matériels / Consommables / Véhicules / Techniciens
   * ============================= */

  // -----------------------------
  // LOAD MATERIELS (paginé)
  // -----------------------------
  private loadMaterials(depotId: string): void {
    this.materialsLoading.set(true);
    this.materialsError.set(null);

    this.materialService.refresh(true, { depot: depotId, page: 1, limit: 50 }).subscribe({
      next: (res) => {
        this.materials.set(res.items ?? []);
        this.materialsLoading.set(false);
      },
      error: (err) => {
        this.materialsLoading.set(false);
        this.materialsError.set(err?.error?.message || 'Erreur chargement matériels');
      },
    });
  }

  // -----------------------------
  // LOAD CONSOMMABLES (paginé)
  // -----------------------------
  private loadConsumables(depotId: string): void {
    this.consumablesLoading.set(true);
    this.consumablesError.set(null);

    this.consumableService.refresh(true, { depot: depotId, page: 1, limit: 50 }).subscribe({
      next: (res) => {
        this.consumables.set(res.items ?? []);
        this.consumablesLoading.set(false);
      },
      error: (err) => {
        this.consumablesLoading.set(false);
        this.consumablesError.set(err?.error?.message || 'Erreur chargement consommables');
      },
    });
  }

  // -----------------------------
  // LOAD VEHICULES (paginé via VehicleService.refresh)
  // -----------------------------
  private loadVehicles(depotId: string): void {
    this.vehiclesLoading.set(true);
    this.vehiclesError.set(null);

    this.vehicleService.refresh(true, { depot: depotId, page: 1, limit: 50 }).subscribe({
      next: (res) => {
        this.vehicles.set(res.items ?? []);
        this.vehiclesLoading.set(false);
      },
      error: (err) => {
        this.vehiclesLoading.set(false);
        this.vehiclesError.set(err?.error?.message || 'Erreur chargement véhicules');
      },
    });
  }

  // -----------------------------
  // LOAD TECHNICIENS (paginé via UserService)
  // -----------------------------
  private loadTechnicians(depotId: string): void {
    this.techLoading.set(true);
    this.techError.set(null);

    this.userService.refreshUsers(true, {
      depot: depotId,
      role: 'TECHNICIEN',
      page: 1,
      limit: 50,
    }).subscribe({
      next: (result) => {
        this.technicians.set(result.items ?? []);
        this.techLoading.set(false);
      },
      error: (err) => {
        this.techLoading.set(false);
        this.techError.set(err?.error?.message || 'Erreur chargement techniciens');
      },
    });
  }

  // -----------------------------
  // LOAD STATS (si endpoint dispo)
  // -----------------------------
  private loadStats(depotId: string): void {
    this.depotService.getDepotStats(depotId).subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.stats.set(null),
    });
  }

  /* =============================
   * Helpers UI (évite logique dans HTML)
   * ============================= */

  // Matériel : label quantité
  materialQtyLabel(m: Material): string {
    const q = typeof m.quantity === 'number' ? m.quantity : 0;
    const a = typeof m.assignedQuantity === 'number' ? m.assignedQuantity : 0;
    const free = Math.max(0, q - a);
    return `stock ${q} • attribué ${a} • dispo ${free}`;
  }

  // Consommable : label quantité
  consumableQtyLabel(c: Consumable): string {
    const q = typeof c.quantity === 'number' ? c.quantity : 0;
    const a = typeof (c as any).assignedQuantity === 'number' ? (c as any).assignedQuantity : 0;
    const free = Math.max(0, q - a);
    return `stock ${q} • réservé ${a} • dispo ${free}`;
  }

  // Véhicule : libellé marque+modèle
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

  /**
   * Label d'état (évite condition dans HTML)
   * - Si assignedTo => ASSIGNÉ
   * - Sinon si idDepot => AU DÉPÔT
   * - Sinon —
   */
  vehicleStateLabel(v: Vehicle): string {
    if ((v as any).assignedTo) return 'ASSIGNÉ';
    if ((v as any).idDepot) return 'AU DÉPÔT';
    return '—';
  }

  /* =============================
   * Actions UI : "Voir tout" + "Modifier"
   * (alignées sur Matériels/Consommables)
   * ============================= */

  // ----- Voir tout
  openAllMaterials(): void {
    this.router.navigate(['/admin/resources/materials'], { queryParams: { depot: this.id } });
  }

  openAllConsumables(): void {
    this.router.navigate(['/admin/resources/consumables'], { queryParams: { depot: this.id } });
  }

  openAllVehicles(): void {
    this.router.navigate(['/admin/resources/vehicles'], { queryParams: { depot: this.id } });
  }

  openAllTechnicians(): void {
    this.router.navigate(['/admin/users'], { queryParams: { depot: this.id, role: 'TECHNICIEN' } });
  }

  // ----- Modifier
  editMaterial(m: Material): void {
    this.router.navigate(['/admin/resources/materials', m._id, 'edit']);
  }

  modifierConsumable(c: Consumable): void {
    // tu avais déjà cette méthode, on la garde (nom FR)
    this.router.navigate(['/admin/resources/consumables', c._id, 'edit']);
  }

  editVehicle(v: Vehicle): void {
    this.router.navigate(['/admin/resources/vehicles', v._id, 'edit']);
  }

  editTechnician(t: User): void {
    this.router.navigate(['/admin/users', t._id, 'edit']);
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
      raw && typeof raw === 'object'
        ? (raw as any)._id
        : (typeof raw === 'string' ? raw : null);

    this.selectedManagerId.set(currentId);

    // charge candidats (role GESTION_DEPOT)
    this.loadManagerCandidates();
  }

  closeManagerEdit(): void {
    this.managerEditOpen.set(false);
    this.managerError.set(null);
  }

  onManagerSelect(event: Event): void {
    const target = event.target instanceof HTMLSelectElement ? event.target : null;
    const value = target?.value ?? '';
    this.selectedManagerId.set(value ? value : null);
  }

  private loadManagerCandidates(): void {
    this.managerCandidatesLoading.set(true);
    this.managerError.set(null);

    this.userService.refreshUsers(true, { role: 'GESTION_DEPOT', page: 1, limit: 100 }).subscribe({
      next: (result) => {
        this.managerCandidates.set(result.items ?? []);
        this.managerCandidatesLoading.set(false);
      },
      error: (err) => {
        this.managerCandidatesLoading.set(false);
        this.managerError.set(err?.error?.message || 'Erreur chargement des gestionnaires');
      },
    });
  }

  saveManager(): void {
    const depotId = this.depot()?._id ?? '';
    if (!depotId) return;

    this.managerSaving.set(true);
    this.managerError.set(null);

    // assignManager(depotId, managerId|null)
    this.depotService.assignManager(depotId, this.selectedManagerId()).subscribe({
      next: (updated) => {
        this.depot.set(updated);
        this.managerSaving.set(false);
        this.managerEditOpen.set(false);
      },
      error: (err) => {
        this.managerSaving.set(false);
        this.managerError.set(err?.error?.message || 'Erreur assignation gestionnaire');
      },
    });
  }

  removeManager(): void {
    this.selectedManagerId.set(null);
    this.saveManager();
  }

  openTechnician(t: { _id: string }): void {
    this.router.navigate(['/admin/users', t._id, 'detail']); // adapte si ta route diffère
  }

  openVehicleDetail(v: { _id: string }): void {
    this.router.navigate(['/admin/resources/vehicles', v._id, 'detail']);
  }

}
