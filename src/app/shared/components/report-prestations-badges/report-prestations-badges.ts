import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type ReportPrestationBadge = {
  code: string;
  qty: number;
  label?: string;
};

/** Couleur déterministe (0-7) basée sur le code de prestation */
function codeColorIndex(code: string): number {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash += code.charCodeAt(i);
  }
  return hash % 8;
}

@Component({
  selector: 'app-report-prestations-badges',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .prestations-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    /* Chip : [badge qty coloré | code mono] */
    .prestations-pill {
      display: inline-flex;
      align-items: stretch;
      border-radius: 8px;
      border: 1px solid rgba(99, 102, 241, 0.3);
      background: rgba(99, 102, 241, 0.07);
      overflow: hidden;
      max-width: 100%;
    }

    /* Badge qty gauche */
    .prestations-pill .qty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      padding: 5px 8px;
      color: #fff;
      font-weight: 700;
      font-size: 11px;
      line-height: 1;
    }

    /* Séparateur + code monospace */
    .prestations-pill .pill-label {
      padding: 5px 10px 5px 9px;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      font-weight: 600;
      font-size: 12px;
      color: var(--fxn-text, #e2e8f0);
      font-family: inherit;
      letter-spacing: 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    /* Dégradés — identiques pill-color-0…7 du formulaire */
    .prestations-pill.color-0 { border-color: rgba(99, 102, 241, 0.35); }
    .prestations-pill.color-0 .qty { background: linear-gradient(135deg, #6366f1, #a855f7); }

    .prestations-pill.color-1 { border-color: rgba(59, 130, 246, 0.35); }
    .prestations-pill.color-1 .qty { background: linear-gradient(135deg, #3b82f6, #ec4899); }

    .prestations-pill.color-2 { border-color: rgba(6, 182, 212, 0.35); }
    .prestations-pill.color-2 .qty { background: linear-gradient(135deg, #06b6d4, #0ea5e9); }

    .prestations-pill.color-3 { border-color: rgba(234, 88, 12, 0.35); }
    .prestations-pill.color-3 .qty { background: linear-gradient(135deg, #ea580c, #f97316); }

    .prestations-pill.color-4 { border-color: rgba(22, 163, 74, 0.35); }
    .prestations-pill.color-4 .qty { background: linear-gradient(135deg, #16a34a, #4ade80); }

    .prestations-pill.color-5 { border-color: rgba(185, 28, 28, 0.35); }
    .prestations-pill.color-5 .qty { background: linear-gradient(135deg, #b91c1c, #ef4444); }

    .prestations-pill.color-6 { border-color: rgba(180, 83, 9, 0.35); }
    .prestations-pill.color-6 .qty { background: linear-gradient(135deg, #b45309, #fbbf24); }

    .prestations-pill.color-7 { border-color: rgba(124, 58, 237, 0.35); }
    .prestations-pill.color-7 .qty { background: linear-gradient(135deg, #7c3aed, #6366f1); }
  `],
  template: `
    @if (items().length) {
      <div class="prestations-summary">
        @for (item of items(); track item.code) {
          <div [class]="'prestations-pill color-' + colorIndex(item.code)">
            <span class="qty">{{ item.qty }}</span>
            <span class="pill-label">{{ item.label || item.code }}</span>
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

  colorIndex(code: string): number {
    return codeColorIndex(code);
  }
}
