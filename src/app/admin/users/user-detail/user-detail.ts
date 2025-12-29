// admin/users/user-detail/user-detail.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { UserService } from '../../../core/services/user.service';
import { DepotService } from '../../../core/services/depot.service';
import { VehicleService } from '../../../core/services/vehicle.service';

import { User, Depot, Vehicle } from '../../../core/models';
import {ConfirmDeleteModal} from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import {DetailBack} from '../../../core/utils/detail-back';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';

// ✅ Modal suppression (ne change pas ton modal)

@Component({
  standalone: true,
  selector: 'app-user-detail',
  templateUrl: './user-detail.html',
  styleUrls: ['./user-detail.scss'],
  imports: [CommonModule, ConfirmDeleteModal],
  providers: [DatePipe],
})
export class UserDetail extends DetailBack {
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private depotService = inject(DepotService);
  private vehicleService = inject(VehicleService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);

  readonly user = signal<User | null>(null);

  // -----------------------------
  // ✅ Données lookup (dépôts + véhicule assigné)
  // -----------------------------
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);

  readonly assignedVehicle = signal<Vehicle | null>(null);
  readonly vehicleLoading = signal(false);

  // Map id -> name (dépôts)
  readonly depotNameById = computed(() => {
    const map = new Map<string, string>();
    for (const d of this.depots()) map.set(d._id, formatDepotName(d.name ?? '') || d.name || '—');
    return map;
  });

  // -----------------------------
  // ✅ Modal suppression (drop-in)
  // -----------------------------
  readonly deleteModalOpen = signal(false);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly pendingDeleteName = signal<string>('');

  // -----------------------------
  // Champs optionnels (comme tu avais)
  // -----------------------------
  readonly createdAtText = computed(() => {
    const u = this.user() as any;
    const dt = u?.createdAt;
    return dt ? (this.datePipe.transform(dt, 'short') ?? '—') : '—';
  });

  readonly updatedAtText = computed(() => {
    const u = this.user() as any;
    const dt = u?.updatedAt;
    return dt ? (this.datePipe.transform(dt, 'short') ?? '—') : '—';
  });

  readonly usernameText = computed(() => {
    const u = this.user() as any;
    return u?.username ? String(u.username) : '—';
  });

  // ✅ Dépôt : affiche le nom si possible
  readonly depotText = computed(() => {
    const u = this.user() as any;
    const d = u?.idDepot;

    if (!d) return 'Non affecté';

    // populate -> objet
    if (typeof d === 'object' && d !== null && '_id' in d) {
      const obj = d as { _id: string; name?: string };
      return formatDepotName(obj.name) || this.depotNameById().get(obj._id) || '—';
    }

    // id string -> map
    if (typeof d === 'string') {
      const name = this.depotNameById().get(d);
      return formatDepotName(name) || d; // fallback = id si pas trouvé
    }

    return '—';
  });

  // ✅ Véhicule : marque + modèle si on a chargé le véhicule
  readonly vehicleText = computed(() => {
    const v = this.assignedVehicle();
    if (v) {
      const parts: string[] = [];
      if (v.brand) parts.push(v.brand);
      if (v.model) parts.push(v.model);
      const label = parts.join(' ').trim();
      return label || v.plateNumber || 'Véhicule';
    }

    // fallback si pas encore chargé / pas trouvé
    const u = this.user() as any;
    const av = u?.assignedVehicle;
    if (!av) return 'Aucun';

    // populate -> objet possible
    if (typeof av === 'object' && av !== null) {
      const obj = av as { brand?: string; model?: string; plateNumber?: string };
      const parts: string[] = [];
      if (obj.brand) parts.push(obj.brand);
      if (obj.model) parts.push(obj.model);
      const label = parts.join(' ').trim();
      return label || obj.plateNumber || 'Véhicule';
    }

    // id string
    if (typeof av === 'string') return av;

    return 'Aucun';
  });

  constructor() {
    super();
    // Charge les dépôts tout de suite pour avoir le mapping id -> name
    this.loadDepots();
    this.load();
  }

  private getId(): string {
    return this.route.snapshot.paramMap.get('id') || '';
  }

  // -----------------------------
  // ✅ Load depots (pour afficher le nom)
  // -----------------------------
  private loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: () => {
        this.depotsLoading.set(false);
        // on ne bloque pas la page si les dépôts échouent
      }
    });
  }

  // -----------------------------
  // ✅ Load vehicle assigné (pour afficher brand/model)
  // -----------------------------
  private loadAssignedVehicleIfNeeded(u: User): void {
    const raw = (u as any)?.assignedVehicle;

    // Si pas de véhicule assigné
    if (!raw) {
      this.assignedVehicle.set(null);
      return;
    }

    // Si déjà populé (objet)
    if (typeof raw === 'object' && raw !== null && '_id' in raw) {
      this.assignedVehicle.set(raw as Vehicle);
      return;
    }

    // Si on a juste un id string -> on fetch le détail
    if (typeof raw === 'string') {
      this.vehicleLoading.set(true);
      this.vehicleService.getById(raw).subscribe({
        next: (veh) => {
          this.assignedVehicle.set(veh);
          this.vehicleLoading.set(false);
        },
        error: (_err: HttpErrorResponse) => {
          this.assignedVehicle.set(null);
          this.vehicleLoading.set(false);
        }
      });
    }
  }

  // -----------------------------
  // Load user
  // -----------------------------
  load(): void {
    const id = this.getId();
    if (!id) {
      this.error.set('ID utilisateur manquant dans l’URL');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.userService.getUser(id).subscribe({
      next: (resp) => {
        const u = (resp as any)?.data ?? resp; // support {success,data} ou objet direct
        this.user.set(u as User);

        // ✅ charge le véhicule si besoin
        this.loadAssignedVehicleIfNeeded(u as User);

        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Impossible de charger la fiche utilisateur');
        this.loading.set(false);
      }
    });
  }

  edit(u: User): void {
    const id = ((u as any)?._id || (u as any)?.id || this.getId()) as string;
    this.router.navigate(['/admin/users', id, 'edit']);
  }

  // -----------------------------
  // ✅ Suppression via modal (pas de confirm())
  // -----------------------------
  delete(u: User): void {
    const id = ((u as any)?._id || (u as any)?.id || this.getId()) as string;
    const label = formatPersonName(u.firstName ?? '', u.lastName ?? '') || u.email || id;

    this.pendingDeleteId.set(id);
    this.pendingDeleteName.set(label);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteId.set(null);
    this.pendingDeleteName.set('');
  }

  confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id) return;

    this.deleting.set(true);
    this.error.set(null);

    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.closeDeleteModal();
        this.router.navigate(['/admin/users']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.closeDeleteModal();
        this.error.set(err?.error?.message || 'Suppression impossible');
      }
    });
  }

  userName(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || u._id;
  }
}
