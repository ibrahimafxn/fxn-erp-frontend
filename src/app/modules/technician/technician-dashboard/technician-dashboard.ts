import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './technician-dashboard.html',
  styleUrl: './technician-dashboard.scss'
})
export class TechnicianDashboard {
  private router = inject(Router);

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
}
