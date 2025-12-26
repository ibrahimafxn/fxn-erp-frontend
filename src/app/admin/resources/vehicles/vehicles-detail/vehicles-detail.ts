// admin/resources/vehicles/vehicle-detail/vehicle-detail.ts
import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { VehicleService } from '../../../../core/services/vehicle.service';
import { DepotService } from '../../../../core/services/depot.service';
import { UserService } from '../../../../core/services/user.service';

import { Depot, User } from '../../../../core/models';
import { Vehicle } from '../../../../core/models';

type AssignMode = 'idle' | 'assign' | 'release';

@Component({
  standalone: true,
  selector: 'app-vehicle-detail',
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './vehicles-detail.html',
  styleUrls: ['./vehicles-detail.scss'],
})
export class VehiclesDetail {
  private vehicleSvc = inject(VehicleService);
  private depotsSvc = inject(DepotService);
  private usersSvc = inject(UserService);

  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Routing
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  // State
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly vehicle = signal<Vehicle | null>(null);

  // Depots preview (si tu veux afficher le nom du dépôt depuis une liste)
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  // Assign / Release UI
  readonly assignMode = signal<AssignMode>('idle');
  readonly actionError = signal<string | null>(null);
  readonly actionSaving = signal(false);

  // Candidats techniciens (si tu veux assigner un véhicule)
  readonly techLoading = signal(false);
  readonly technicians = signal<User[]>([]);
  readonly selectedTechId = signal<string>('');

  // "Auteur" (optionnel) si ton backend log l’auteur
  readonly authorId = signal<string | null>(null);

  // --- computed helpers ---
  readonly hasVehicle = computed(() => this.vehicle() !== null);

  readonly title = computed(() => {
    const v = this.vehicle();
    if (!v) return 'Détail véhicule';
    const parts: string[] = [];
    if (v.brand) parts.push(v.brand);
    if (v.model) parts.push(v.model);
    const label = parts.join(' ').trim();
    return label || (v.plateNumber ?? 'Véhicule');
  });

  readonly badge = computed(() => {
    const v = this.vehicle();
    if (!v) return { text: '—', css: 'badge-muted' };

    const assigned = !!v.assignedTo;
    const available = !assigned && !!v.idDepot;

    if (assigned) return { text: 'Assigné', css: 'badge-warn' };
    if (available) return { text: 'Disponible', css: 'badge-ok' };
    return { text: 'Non affecté', css: 'badge-muted' };
  });

  readonly createdAtValue = computed(() => this.vehicle()?.createdAt ?? null);

  constructor() {
    this.loadDepots(); // pour “preview dépôt actuel” (nom)
    this.load();
  }

  // -----------------------------
  // Load vehicle
  // -----------------------------
  load(): void {
    if (!this.id) {
      this.error.set('ID véhicule manquant dans l’URL');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // ⚠️ adapte si ton service a une méthode différente
    this.vehicleSvc.getById(this.id).subscribe({
      next: (v) => {
        this.vehicle.set(v);
        this.loading.set(false);

        // preload techniciens uniquement si utile (ex: assign panel)
        this.loadTechniciansIfNeeded();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.error.set(apiMsg || err.message || 'Erreur chargement véhicule');
      },
    });
  }

  // -----------------------------
  // Depots (preview nom)
  // -----------------------------
  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotsSvc.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => this.depotsLoading.set(false),
    });
  }

  depotNameById(idDepot: string | null | undefined): string {
    if (!idDepot) return '—';
    const d = this.depots().find(x => x._id === idDepot);
    return d?.name ?? '—';
  }

  // -----------------------------
  // Assign/Release panels
  // -----------------------------
  openAssign(): void {
    this.actionError.set(null);
    this.assignMode.set('assign');
    this.loadTechniciansIfNeeded();
  }

  openRelease(): void {
    this.actionError.set(null);
    this.assignMode.set('release');
  }

  closeActions(): void {
    if (this.actionSaving()) return;
    this.assignMode.set('idle');
    this.actionError.set(null);
    this.selectedTechId.set('');
  }

  private loadTechniciansIfNeeded(): void {
    if (this.technicians().length > 0) return;

    this.techLoading.set(true);

    this.usersSvc.refreshUsers(true, {
      role: 'TECHNICIEN',
      page: 1,
      limit: 200,
    }).subscribe({
      next: (res) => {
        this.technicians.set(res.items ?? []);
        this.techLoading.set(false);
      },
      error: () => {
        this.techLoading.set(false);
      },
    });
  }

  onTechSelect(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    this.selectedTechId.set(el.value);
  }

  assignToTech(): void {
    const v = this.vehicle();
    const techId = this.selectedTechId();
    if (!v) return;

    if (!techId) {
      this.actionError.set('Veuillez sélectionner un technicien.');
      return;
    }

    this.actionSaving.set(true);
    this.actionError.set(null);

    this.vehicleSvc.assignVehicle(v._id, {
      techId,
      author: this.authorId() ?? undefined,
    }).subscribe({
      next: () => {
        this.actionSaving.set(false);
        this.assignMode.set('idle');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.actionSaving.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.actionError.set(apiMsg || err.message || 'Erreur assignation véhicule');
      },
    });
  }

  releaseToDepot(): void {
    const v = this.vehicle();
    if (!v) return;

    const depotId = this.selectedDepotId(); // ✅ depuis un select
    if (!depotId) {
      this.actionError.set('Veuillez sélectionner un dépôt de retour.');
      return;
    }

    this.actionSaving.set(true);
    this.actionError.set(null);

    this.vehicleSvc.releaseVehicle(v._id, {
      depotId,
      author: this.authorId() ?? undefined,
    }).subscribe({
      next: () => {
        this.actionSaving.set(false);
        this.assignMode.set('idle');
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.actionSaving.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.actionError.set(apiMsg || err.message || 'Erreur reprise véhicule');
      },
    });
  }

  // -----------------------------
  // Navigation
  // -----------------------------
  back(): void {
    this.router.navigate(['/admin/resources/vehicles']).then();
  }

  edit(): void {
    this.router.navigate(['/admin/resources/vehicles', this.id, 'edit']).then();
  }
}
