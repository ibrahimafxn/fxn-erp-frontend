import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { OrderService } from '../../../core/services/order.service';
import { ResourceListItem, ResourceListService } from '../../../core/services/resource-list.service';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-order-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './order-form.html',
  styleUrls: ['./order-form.scss']
})
export class OrderForm {
  private fb = inject(FormBuilder);
  private orders = inject(OrderService);
  private resourcesSvc = inject(ResourceListService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly tvaRate = 0.2;

  readonly saving = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);
  readonly resourcesLoading = signal(false);
  readonly resourcesError = signal<string | null>(null);
  readonly resources = signal<ResourceListItem[]>([]);
  readonly clientsLoading = signal(false);
  readonly clientsError = signal<string | null>(null);
  readonly clients = signal<string[]>([]);
  private orderId = this.route.snapshot.paramMap.get('id') || '';
  readonly isEdit = computed(() => Boolean(this.orderId));
  readonly title = computed(() => (this.isEdit() ? 'Modifier la commande' : 'Nouvelle commande'));

  readonly form = this.fb.nonNullable.group({
    reference: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    client: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    date: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), [Validators.required]),
    status: this.fb.nonNullable.control('En cours', [Validators.required]),
    amount: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    notes: this.fb.nonNullable.control(''),
    lines: this.fb.array([this.buildLine()])
  });

  constructor() {
    this.loadResources();
    this.loadClients();
    this.lines.valueChanges.subscribe(() => {
      this.syncAmount();
    });
    this.form.get('client')?.valueChanges.subscribe((value) => {
      this.syncClientList(String(value || '').trim());
    });
    if (this.isEdit()) {
      this.loadOrder();
    } else {
      this.syncAmount();
    }
  }

  resourceLabel(item: ResourceListItem): string {
    const type = item.type === 'MATERIAL' ? 'Materiel' : 'Consommable';
    return `${item.name} · ${type}`;
  }

  onResourceChange(index: number): void {
    const group = this.lines.at(index) as FormGroup;
    const resourceId = String(group.get('resourceId')?.value || '');
    const resource = this.resources().find((item) => item._id === resourceId);
    if (!resource) {
      group.patchValue({ resourceType: '', name: '' });
      return;
    }
    group.patchValue({ resourceType: resource.type, name: resource.name });
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  lineGroup(index: number): FormGroup {
    return this.lines.at(index) as FormGroup;
  }

  addLine(): void {
    this.lines.push(this.buildLine());
  }

  backToList(): void {
    this.router.navigate(['/admin/orders']).then();
  }

  removeLine(index: number): void {
    if (this.lines.length <= 1) return;
    this.lines.removeAt(index);
  }

  lineTotal(index: number): number {
    const group = this.lines.at(index) as FormGroup;
    const qty = Number(group.get('quantity')?.value || 0);
    const unitPrice = Number(group.get('unitPrice')?.value || 0);
    return qty * unitPrice;
  }

  linesTotal(): number {
    return this.lines.controls.reduce((sum, _, index) => sum + this.lineTotal(index), 0);
  }

  tvaAmount(): number {
    return this.lines.controls.reduce((sum, _, index) => {
      const group = this.lines.at(index) as FormGroup;
      const applyTva = Boolean(group.get('applyTva')?.value);
      if (!applyTva) return sum;
      return sum + this.lineTotal(index) * this.tvaRate;
    }, 0);
  }

  ttcAmount(): number {
    return this.linesTotal() + this.tvaAmount();
  }

  formatCurrency(value?: number | string | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(null);

    const raw = this.form.getRawValue();
    const resources = this.resources();
    const payload = {
      reference: raw.reference.trim(),
      client: raw.client.trim(),
      date: raw.date,
      status: raw.status.trim(),
      amount: this.linesTotal(),
      notes: raw.notes.trim() || undefined,
      lines: (raw.lines || []).map((line) => ({
        resourceId: String(line["resourceId"] || '').trim(),
        resourceType: line["resourceType"] || resources.find((r) => r._id === line["resourceId"])?.type || '',
        name: String(line["name"] || resources.find((r) => r._id === line["resourceId"])?.name || '').trim(),
        item: String(line["name"] || resources.find((r) => r._id === line["resourceId"])?.name || '').trim(),
        description: String(line["description"] || '').trim() || undefined,
        applyTva: Boolean(line["applyTva"]),
        quantity: Number(line["quantity"] || 0),
        unitPrice: Number(line["unitPrice"] || 0)
      }))
    };

    const request$ = this.isEdit()
      ? this.orders.update(this.orderId, payload)
      : this.orders.create(payload);

    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        const id = res?.data?._id || (res?.data as { id?: string } | undefined)?.id || '';
        if (!id) {
          this.submitSuccess.set('Commande créée, ID manquant.');
          this.router.navigate(['/admin/orders']).then();
          return;
        }
        this.submitSuccess.set(this.isEdit() ? 'Commande modifiée.' : 'Commande créée.');
        this.router.navigate(['/admin/orders', id, 'detail']).then();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.submitError.set(apiMsg || err.message || 'Erreur création commande');
      }
    });
  }

  private buildLine(): FormGroup {
    return this.fb.nonNullable.group({
      resourceId: this.fb.nonNullable.control('', [Validators.required]),
      resourceType: this.fb.nonNullable.control('', [Validators.required]),
      name: this.fb.nonNullable.control('', [Validators.required]),
      description: this.fb.nonNullable.control(''),
      applyTva: this.fb.nonNullable.control(true),
      quantity: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
      unitPrice: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)])
    });
  }

  private loadOrder(): void {
    if (!this.orderId) return;
    this.saving.set(true);
    this.orders.getById(this.orderId).subscribe({
      next: (res) => {
        const order = res.data;
        this.form.patchValue({
          reference: order.reference || '',
          client: order.client || '',
          date: this.toDateInput(order.date),
          status: order.status || '',
          notes: order.notes || ''
        });
        this.lines.clear();
        (order.lines || []).forEach((line) => {
          const group = this.buildLine();
          group.patchValue({
            resourceId: line.resourceId || '',
            resourceType: line.resourceType || '',
            name: line.name || '',
            description: line.description || '',
            applyTva: line.applyTva ?? true,
            quantity: line.quantity || 1,
            unitPrice: line.unitPrice || 0
          });
          this.lines.push(group);
        });
        if (this.lines.length === 0) this.lines.push(this.buildLine());
        this.syncAmount();
        this.saving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.submitError.set(apiMsg || err.message || 'Erreur chargement commande');
        this.saving.set(false);
      }
    });
  }

  private syncAmount(): void {
    const total = this.linesTotal();
    this.form.patchValue({ amount: total }, { emitEvent: false });
  }

  private toDateInput(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  private loadResources(): void {
    this.resourcesLoading.set(true);
    this.resourcesError.set(null);
    this.resourcesSvc.refresh().subscribe({
      next: (res) => {
        this.resources.set(res.data || []);
        this.applyResourceMetadataToLines();
        this.resourcesLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.resourcesError.set(apiMsg || err.message || 'Erreur chargement articles');
        this.resourcesLoading.set(false);
      }
    });
  }

  private applyResourceMetadataToLines(): void {
    const items = this.resources();
    if (!items.length) return;
    this.lines.controls.forEach((control) => {
      const group = control as FormGroup;
      const resourceId = String(group.get('resourceId')?.value || '');
      if (!resourceId) return;
      const resource = items.find((item) => item._id === resourceId);
      if (!resource) return;
      group.patchValue({ resourceType: resource.type, name: resource.name }, { emitEvent: false });
    });
  }

  private loadClients(): void {
    this.clientsLoading.set(true);
    this.clientsError.set(null);
    this.orders.listClients().subscribe({
      next: (res) => {
        this.clients.set(res.data || []);
        this.clientsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const apiMsg =
          typeof err.error === 'object' && err.error !== null && 'message' in err.error
            ? String((err.error as { message?: unknown }).message ?? '')
            : '';
        this.clientsError.set(apiMsg || err.message || 'Erreur chargement clients');
        this.clientsLoading.set(false);
      }
    });
  }

  private findExistingClient(name: string): string | null {
    if (!name) return null;
    const lower = name.toLowerCase();
    const match = this.clients().find((c) => c.toLowerCase() === lower);
    return match || null;
  }

  private syncClientList(name: string): void {
    if (!name) return;
    const existing = this.findExistingClient(name);
    if (existing) return;
    this.clients.set([...this.clients(), name]);
  }
}
