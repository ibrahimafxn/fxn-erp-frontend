import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Absence, AbsenceHistoryItem, AbsenceStatus } from '../models';
import { AppNotificationService } from './app-notification.service';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class AbsenceService {
  private readonly baseUrl = `${environment.apiBaseUrl}/absences`;

  private notif = inject(AppNotificationService);

  private _pendingCount = signal(0);
  private _lastPendingCount = 0;
  readonly pendingCount = this._pendingCount.asReadonly();

  private _absenceBadgeCount = signal(0);
  private _absenceLatestDecidedAt = signal<string | null>(null);
  readonly absenceBadgeCount = this._absenceBadgeCount.asReadonly();

  constructor(private http: HttpClient) {}

  refreshPendingCount(): void {
    const params = new HttpParams().set('status', 'EN_ATTENTE');
    this.http.get<ApiResponse<Absence[]>>(this.baseUrl, { params }).subscribe({
      next: (res) => {
        const count = res?.data?.length ?? 0;
        const prev = this._lastPendingCount;
        if (prev > 0 && count > prev) {
          const diff = count - prev;
          this.notif.notifyAction(
            `Nouvelle demande d'absence`,
            `${diff} nouvelle${diff > 1 ? 's' : ''} demande${diff > 1 ? 's' : ''} d'absence en attente de décision.`,
            `admin-absence-new-${Date.now()}`
          );
          this.notif.beep('alert');
        }
        this._lastPendingCount = count;
        this._pendingCount.set(count);
      },
      error: () => this._pendingCount.set(0)
    });
  }

  /** Vérifie les absences décidées (APPROUVE/REFUSE) pour le technicien connecté et met à jour le badge. */
  refreshAbsenceBadgeMine(): void {
    this.list().subscribe({
      next: (res) => {
        const data = res?.data ?? [];
        const decided = data.filter(a => a.status === 'APPROUVE' || a.status === 'REFUSE');
        const latest = decided.reduce<string | null>((acc, a) => {
          const t = (a as { updatedAt?: string }).updatedAt ?? null;
          if (!t) return acc;
          if (!acc || new Date(t) > new Date(acc)) return t;
          return acc;
        }, null);
        this._absenceLatestDecidedAt.set(latest);
        const seenTs = this.loadSeenAt();
        const latestTs = latest ? new Date(latest).getTime() : 0;
        this._absenceBadgeCount.set(latestTs > seenTs ? decided.length : 0);
      },
      error: () => {
        this._absenceBadgeCount.set(0);
        this._absenceLatestDecidedAt.set(null);
      }
    });
  }

  markAbsenceBadgeSeen(): void {
    const latest = this._absenceLatestDecidedAt();
    this.persistSeenAt(latest || new Date().toISOString());
    this._absenceBadgeCount.set(0);
  }

  private loadSeenAt(): number {
    if (typeof localStorage === 'undefined') return 0;
    try {
      const val = localStorage.getItem('fxn_absence_seen_at');
      return val ? new Date(val).getTime() : 0;
    } catch { return 0; }
  }

  private persistSeenAt(value: string): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem('fxn_absence_seen_at', value); } catch { /* ignore */ }
  }

  list(params?: {
    fromDate?: string;
    toDate?: string;
    technicianId?: string;
    depotId?: string;
    status?: string;
    type?: string;
  }): Observable<ApiResponse<Absence[]>> {
    let httpParams = new HttpParams();
    if (params?.fromDate) httpParams = httpParams.set('from', params.fromDate);
    if (params?.toDate) httpParams = httpParams.set('to', params.toDate);
    if (params?.technicianId) httpParams = httpParams.set('technician', params.technicianId);
    if (params?.depotId) httpParams = httpParams.set('depot', params.depotId);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.type) httpParams = httpParams.set('type', params.type);
    return this.http.get<ApiResponse<Absence[]>>(this.baseUrl, { params: httpParams });
  }

  history(absenceId: string): Observable<ApiResponse<AbsenceHistoryItem[]>> {
    const httpParams = new HttpParams().set('absenceId', absenceId);
    return this.http.get<ApiResponse<AbsenceHistoryItem[]>>(`${this.baseUrl}/history`, { params: httpParams });
  }

  create(payload: Absence): Observable<ApiResponse<Absence>> {
    return this.http.post<ApiResponse<Absence>>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<Absence>): Observable<ApiResponse<Absence>> {
    return this.http.put<ApiResponse<Absence>>(`${this.baseUrl}/${id}`, payload);
  }

  updateStatus(id: string, status: AbsenceStatus): Observable<ApiResponse<Absence>> {
    return this.http.patch<ApiResponse<Absence>>(`${this.baseUrl}/${id}/status`, { status });
  }

  remove(id: string): Observable<ApiResponse<{ ok: boolean }>> {
    return this.http.delete<ApiResponse<{ ok: boolean }>>(`${this.baseUrl}/${id}`);
  }
}
