// depotDetail.ts

import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { DepotService } from '../../../core/services/depot.service';
import { UserService } from '../../../core/services/user.service';
import { Depot, DepotManager } from '../../../core/models';
import { User } from '../../../core/models';

@Component({
  standalone: true,
  selector: 'app-depot-detail',
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './depot-detail.html',
  styleUrls: ['./depot-detail.scss']
})
export class DepotDetail {
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
   * Techniciens du dépôt
   * ----------------------------- */
  readonly techLoading = signal(false);
  readonly techError = signal<string | null>(null);
  readonly technicians = signal<User[]>([]);

  /* -----------------------------
   * KPIs (préparés pour API future)
   * ----------------------------- */
  readonly kpis = computed(() => ({
    materials: '—',
    consumables: '—',
    technicians: String(this.technicians().length),
    vehicles: '—'
  }));

  /* -----------------------------
   * ID courant
   * ----------------------------- */
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';

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
        this.loadTechnicians(depot._id);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement dépôt');
      }
    });
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
}
