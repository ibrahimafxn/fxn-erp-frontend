import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { InterventionItem } from '../../../core/services/intervention.service';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-interventions-detail',
  imports: [CommonModule],
  templateUrl: './interventions-detail.html',
  styleUrls: ['./interventions-detail.scss'],
})
export class InterventionsDetail implements OnInit {
  private router = inject(Router);
  private location = inject(Location);

  readonly item = signal<InterventionItem | null>(null);

  ngOnInit(): void {
    const state = this.router.lastSuccessfulNavigation()?.extras?.state ?? history.state;
    const item: InterventionItem | undefined = state?.['item'];
    if (item) {
      this.item.set(item);
    } else {
      this.goBack();
    }
  }

  goBack(): void {
    this.location.back();
  }

  technicianLabel(item: InterventionItem): string {
    if (item.techFull) return item.techFull;
    return [item.techFirstName, item.techLastName].filter(Boolean).join(' ') || '—';
  }

  dateLabel(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('fr-FR');
  }

  timeLabel(d: string | null | undefined): string {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  boolLabel(v: boolean | undefined): string {
    return v === true ? 'Oui' : v === false ? 'Non' : '—';
  }

  csvEntries(record: Record<string, string> | undefined): { key: string; value: string }[] {
    if (!record) return [];
    return Object.entries(record).map(([key, value]) => ({ key, value }));
  }
}
