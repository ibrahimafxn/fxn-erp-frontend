import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ConsumableService } from "../../../../core/services/consumable.service";
import {DepotService} from '../../../../core/services/depot.service';
import {Consumable, Depot, DepotLite} from '../../../../core/models';
import {toSignal} from '@angular/core/rxjs-interop';
import {DetailBack} from '../../../../core/utils/detail-back';
import { formatDepotName } from '../../../../core/utils/text-format';

type Mode = 'create' | 'edit';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-consumable-form',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './consumables-form.html',
  styleUrls: ['./consumables-form.scss'],
})
export class ConsumablesForm extends DetailBack {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  private consumableService = inject(ConsumableService);
  private depotService = inject(DepotService);

  // ─────────────────────────────────────────────
  // Routing
  // ─────────────────────────────────────────────
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly mode = computed<Mode>(() => (this.id ? 'edit' : 'create'));

  // ─────────────────────────────────────────────
  // State signals
  // ─────────────────────────────────────────────
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  depotOptionLabel(d: Depot): string {
    return formatDepotName(d.name ?? '') || '—';
  }

  // Liste dépôts (select)
  readonly depots = signal<Depot[]>([]);
  readonly depotsLoading = signal(false);
  readonly depotsError = signal<string | null>(null);

  // Consommable chargé en édition
  readonly current = signal<Consumable | null>(null);

  // ─────────────────────────────────────────────
  // Form
  // ─────────────────────────────────────────────
  readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    description: this.fb.nonNullable.control(''),
    unit: this.fb.nonNullable.control('pcs', [Validators.required]),
    quantity: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    minQuantity: this.fb.nonNullable.control(0, [Validators.min(0)]),
    idDepot: this.fb.control<string | null>(null),
  });

  // ✅ Signal “réactif” sur l’état du formulaire
  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  // UI helpers
  readonly title = computed(() =>
    this.mode() === 'create' ? 'Nouveau consommable' : 'Modifier consommable'
  );

  // ✅ canSubmit se met à jour quand saving() OU status du form change
  readonly canSubmit = computed(() => !this.saving() && this.formStatus() === 'VALID');

  constructor() {
    super();
    this.loadDepots();
    if (this.mode() === 'edit') this.loadConsumable();
  }

  // ─────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────

  private loadDepots(): void {
    // On suppose que DepotService.refreshDepots() renvoie DepotListResult
    // et qu’il expose result() avec .items.
    this.depotsLoading.set(true);
    this.depotsError.set(null);

    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (res) => {
        this.depots.set(res.items ?? []);
        this.depotsLoading.set(false);
      },
      error: (err) => {
        this.depotsLoading.set(false);
        this.depotsError.set(err?.error?.message || 'Erreur chargement dépôts');
      },
    });
  }

  private loadConsumable(): void {
    this.loading.set(true);
    this.error.set(null);

    this.consumableService.getById(this.id).subscribe({
      next: (found) => {
        this.current.set(found);

        function isDepotLite(v: unknown): v is DepotLite {
          return !!v && typeof v === 'object' && '_id' in v;
        }

        // ✅ idDepot doit être un string (ObjectId) ou null pour le form
        const depotId: string | null =
          typeof found.idDepot === 'string'
            ? found.idDepot
            : isDepotLite(found.idDepot)
              ? found.idDepot._id
              : null;

        this.form.patchValue({
          name: found.name ?? '',
          description: found.description ?? '',
          unit: found.unit ?? 'pcs',
          quantity: typeof found.quantity === 'number' ? found.quantity : 0,
          minQuantity: typeof found.minQuantity === 'number' ? found.minQuantity : 0,
          idDepot: depotId
        });

        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement consommable');
      }
    });
  }

  // ─────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────

  submit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload = { ...this.form.getRawValue() };
    const { idDepot, ...payloadWithoutDepot } = payload;
    const finalPayload = idDepot ? payload : payloadWithoutDepot;

    if (this.mode() === 'create') {
      this.consumableService.create(finalPayload).subscribe({
        next: () => {
          this.saving.set(false);
          this.consumableService.clearCache();
          this.router.navigate(['/admin/resources/consumables']);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Erreur création consommable');
        },
      });
      return;
    }

    // edit
    this.consumableService.update(this.id, finalPayload).subscribe({
      next: () => {
        this.saving.set(false);
        this.consumableService.clearCache();
        this.router.navigate(['/admin/resources/consumables']);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Erreur mise à jour consommable');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/resources/consumables']);
  }

  // Pour afficher une erreur “propre”
  errorText(): string {
    return this.error() ?? '';
  }

  // Helpers template
  isInvalid(name: 'name' | 'description' | 'unit' | 'quantity' | 'minQuantity' | 'idDepot'): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

}
