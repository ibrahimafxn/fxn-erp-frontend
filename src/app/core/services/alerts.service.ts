import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

type AlertsSummary = {
  lowStockConsumables: number;
  lowStockMaterials: number;
  vehicleAlerts: number;
  totalAlerts: number;
};

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private baseUrl = `${environment.apiBaseUrl}/alerts/summary`;

  private _count = signal(0);
  readonly count = this._count.asReadonly();

  constructor(private http: HttpClient) {}

  refresh(): void {
    this.http.get<{ success: boolean; data: AlertsSummary }>(this.baseUrl).subscribe({
      next: (res) => {
        const total = res?.data?.totalAlerts ?? 0;
        this._count.set(total);
      },
      error: () => {
        this._count.set(0);
      }
    });
  }
}
