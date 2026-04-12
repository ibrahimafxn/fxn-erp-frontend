import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SupplyRequest, SupplyRequestList, SupplyRequestStatus, SupplyRequestType } from '../models';
import { AppNotificationService } from './app-notification.service';

type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: unknown };

@Injectable({ providedIn: 'root' })
export class SupplyRequestService {
  private baseUrl = `${environment.apiBaseUrl}/supply-requests`;
  private notif = inject(AppNotificationService);

  private _supplyBadgeCount = signal(0);
  private _supplyLatestDecidedAt = signal<string | null>(null);
  readonly supplyBadgeCount = this._supplyBadgeCount.asReadonly();

  private _depotSupplyPendingCount = signal(0);
  private _lastDepotSupplyCount = 0;
  readonly depotSupplyPendingCount = this._depotSupplyPendingCount.asReadonly();

  constructor(private http: HttpClient) {}

  /** Vérifie les demandes décidées (APPROVED/CANCELED) et met à jour le badge. */
  refreshSupplyBadgeMine(): void {
    this.summaryMine().subscribe({
      next: (res) => {
        const decided = res?.data?.decided ?? 0;
        const latest = res?.data?.latestDecidedAt ?? null;
        this._supplyLatestDecidedAt.set(latest);
        const seenTs = this.loadSeenAt('fxn_supply_seen_at');
        const latestTs = latest ? new Date(latest).getTime() : 0;
        this._supplyBadgeCount.set(latestTs > seenTs ? decided : 0);
      },
      error: () => {
        this._supplyBadgeCount.set(0);
        this._supplyLatestDecidedAt.set(null);
      }
    });
  }

  markSupplyBadgeSeen(): void {
    const latest = this._supplyLatestDecidedAt();
    this.persistSeenAt('fxn_supply_seen_at', latest || new Date().toISOString());
    this._supplyBadgeCount.set(0);
  }

  /** Compte les demandes PENDING pour le gestionnaire dépôt et notifie si une nouvelle arrive. */
  refreshDepotPendingCount(): void {
    this.list({ status: 'PENDING', limit: 1, page: 1 }).subscribe({
      next: (res) => {
        const count = res?.data?.total ?? 0;
        const prev = this._lastDepotSupplyCount;
        if (prev > 0 && count > prev) {
          const diff = count - prev;
          this.notif.notifyAction(
            `Nouvelle demande d'approvisionnement`,
            `${diff} nouvelle${diff > 1 ? 's' : ''} demande${diff > 1 ? 's' : ''} en attente de traitement.`,
            `depot-supply-new-${Date.now()}`
          );
          this.notif.beep('alert');
        }
        this._lastDepotSupplyCount = count;
        this._depotSupplyPendingCount.set(count);
      },
      error: () => this._depotSupplyPendingCount.set(0)
    });
  }

  private loadSeenAt(key: string): number {
    if (typeof localStorage === 'undefined') return 0;
    try {
      const val = localStorage.getItem(key);
      return val ? new Date(val).getTime() : 0;
    } catch { return 0; }
  }

  private persistSeenAt(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }

  list(params?: {
    page?: number;
    limit?: number;
    status?: SupplyRequestStatus | '';
    resourceType?: SupplyRequestType | '';
    depotId?: string;
    technicianId?: string;
  }): Observable<ApiResponse<SupplyRequestList>> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.resourceType) httpParams = httpParams.set('resourceType', params.resourceType);
    if (params?.depotId) httpParams = httpParams.set('depot', params.depotId);
    if (params?.technicianId) httpParams = httpParams.set('technician', params.technicianId);
    return this.http.get<ApiResponse<SupplyRequestList>>(this.baseUrl, { params: httpParams });
  }

  listMine(params?: {
    page?: number;
    limit?: number;
    status?: SupplyRequestStatus | '';
    resourceType?: SupplyRequestType | '';
  }): Observable<ApiResponse<SupplyRequestList>> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.resourceType) httpParams = httpParams.set('resourceType', params.resourceType);
    return this.http.get<ApiResponse<SupplyRequestList>>(`${this.baseUrl}/my`, { params: httpParams });
  }

  summaryMine(): Observable<ApiResponse<{ pending: number; approved: number; canceled: number; decided: number; latestDecidedAt?: string | null }>> {
    return this.http.get<ApiResponse<{ pending: number; approved: number; canceled: number; decided: number; latestDecidedAt?: string | null }>>(
      `${this.baseUrl}/my/summary`
    );
  }

  create(payload: {
    resourceType: SupplyRequestType;
    resourceId: string;
    quantity: number;
    note?: string;
  }): Observable<ApiResponse<SupplyRequest>> {
    return this.http.post<ApiResponse<SupplyRequest>>(this.baseUrl, payload);
  }

  update(id: string, payload: {
    resourceType: SupplyRequestType;
    resourceId: string;
    quantity: number;
    note?: string;
  }): Observable<ApiResponse<SupplyRequest>> {
    return this.http.put<ApiResponse<SupplyRequest>>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<ApiResponse<{ _id: string }>> {
    return this.http.delete<ApiResponse<{ _id: string }>>(`${this.baseUrl}/${id}`);
  }

  decide(id: string, payload: { status: 'APPROVED' | 'CANCELED'; comment: string }): Observable<ApiResponse<SupplyRequest>> {
    return this.http.put<ApiResponse<SupplyRequest>>(`${this.baseUrl}/${id}/decision`, payload);
  }
}
