import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal } from '@angular/core';
import { OsirisEquipmentService, OsirisMyEquipment } from '../../../core/services/osiris-equipment.service';
import { TechnicianMobileNav } from '../technician-mobile-nav/technician-mobile-nav';

@Component({
  selector: 'app-technician-osiris-equipment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TechnicianMobileNav],
  templateUrl: './technician-osiris-equipment.html',
  styleUrl: './technician-osiris-equipment.scss',
})
export class TechnicianOsirisEquipment {
  private svc = inject(OsirisEquipmentService);
  private cdr = inject(ChangeDetectorRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<OsirisMyEquipment | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.myEquipment().subscribe({
      next: (res) => {
        this.data.set(res.data);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error.set(err?.error?.message || err?.message || 'Erreur chargement');
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }
}
