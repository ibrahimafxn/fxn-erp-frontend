import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SupplyRequestService } from '../../../core/services/supply-request.service';
import { AbsenceService } from '../../../core/services/absence.service';

@Component({
  selector: 'app-technician-mobile-nav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './technician-mobile-nav.html',
  styleUrl: './technician-mobile-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechnicianMobileNav {
  private supplyService = inject(SupplyRequestService);
  private absenceService = inject(AbsenceService);

  readonly menuOpen = signal(false);
  readonly supplyBadgeCount = this.supplyService.supplyBadgeCount;
  readonly absenceBadgeCount = this.absenceService.absenceBadgeCount;

  readonly totalSheetBadge = () =>
    this.supplyBadgeCount() + this.absenceBadgeCount();

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
