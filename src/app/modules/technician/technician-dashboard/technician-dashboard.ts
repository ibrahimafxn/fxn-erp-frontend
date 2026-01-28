import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TechnicianReportService } from '../../../core/services/technician-report.service';

@Component({
  selector: 'app-technician-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './technician-dashboard.html',
  styleUrl: './technician-dashboard.scss'
})
export class TechnicianDashboard {
  private router = inject(Router);
  private reports = inject(TechnicianReportService);

  readonly caLoading = signal(false);
  readonly caError = signal<string | null>(null);
  readonly dailyAmount = signal(0);
  readonly todayLabel = computed(() => new Date().toLocaleDateString('fr-FR'));

  constructor() {
    this.loadCa();
  }

  goStock(): void {
    this.router.navigate(['/technician/resources/materials']).then();
  }

  goConsumables(): void {
    this.router.navigate(['/technician/resources/consumables']).then();
  }

  goVehicles(): void {
    this.router.navigate(['/technician/resources/vehicles']).then();
  }

  goReports(): void {
    this.router.navigate(['/technician/reports']).then();
  }

  goHistory(): void {
    this.router.navigate(['/technician/history']).then();
  }

  private loadCa(): void {
    this.caLoading.set(true);
    this.caError.set(null);
    const today = new Date();
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const fmt = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${dayOfMonth}`;
    };

    forkJoin({
      daily: this.reports.summary({ fromDate: fmt(day), toDate: fmt(day) })
    }).subscribe({
      next: (res) => {
        this.dailyAmount.set(res.daily.data.totalAmount || 0);
        this.caLoading.set(false);
      },
      error: (err) => {
        this.caLoading.set(false);
        this.caError.set(err?.message || 'Erreur chargement CA');
      }
    });
  }

  formatAmount(value?: number | null): string {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}
