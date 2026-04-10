import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type ReportPrestationBadge = {
  code: string;
  qty: number;
};

@Component({
  selector: 'app-report-prestations-badges',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <div class="prestations-summary">
        @for (item of items(); track item.code) {
          <div class="prestations-pill">
            <span class="qty">{{ item.qty }}</span>
            <span class="pill-label">{{ item.code }}</span>
          </div>
        }
      </div>
    } @else {
      <span>—</span>
    }
  `
})
export class ReportPrestationsBadges {
  readonly items = input<ReportPrestationBadge[]>([]);
}
