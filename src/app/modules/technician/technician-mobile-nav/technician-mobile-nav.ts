import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SupplyRequestService } from '../../../core/services/supply-request.service';
import { AbsenceService } from '../../../core/services/absence.service';
import { OsirisEquipmentService } from '../../../core/services/osiris-equipment.service';

@Component({
  selector: 'app-technician-mobile-nav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './technician-mobile-nav.html',
  styleUrl: './technician-mobile-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnicianMobileNav {
  private static readonly OSIRIS_LOW_STOCK_THRESHOLD = 4;

  private supplyService = inject(SupplyRequestService);
  private absenceService = inject(AbsenceService);
  private osirisEquipment = inject(OsirisEquipmentService);
  private cdr = inject(ChangeDetectorRef);

  readonly menuOpen = signal(false);
  readonly supplyBadgeCount = this.supplyService.supplyBadgeCount;
  readonly absenceBadgeCount = this.absenceService.absenceBadgeCount;
  readonly osirisLowStockCount = signal(0);
  readonly hasOsirisLowStock = computed(() => this.osirisLowStockCount() > 0);

  readonly totalSheetBadge = () =>
    this.supplyBadgeCount() + this.absenceBadgeCount() + this.osirisLowStockCount();

  constructor() {
    this.loadOsirisLowStock();
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  private loadOsirisLowStock(): void {
    this.osirisEquipment.myEquipment().subscribe({
      next: (res) => {
        const count = (res.data?.equipment ?? []).filter(
          (entry) => Number(entry.count || 0) < TechnicianMobileNav.OSIRIS_LOW_STOCK_THRESHOLD
        ).length;
        this.osirisLowStockCount.set(count);
        this.cdr.markForCheck();
      },
      error: () => {
        this.osirisLowStockCount.set(0);
      }
    });
  }
}
