import {Injectable, signal, Signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, of, tap} from 'rxjs';
import {DepotStats} from '../models/depotStats.model';
import {Depot} from '../models/depot.model';
import {environment} from '../../environments/environment';

const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class DepotService {

  // --- Stats d'un dépôt ---
  private _stats = signal<DepotStats | null>(null);
  readonly stats: Signal<DepotStats | null> = this._stats.asReadonly();

  // --- Liste des dépôts ---
  private _depots = signal<Depot[] | null>(null);
  readonly depots: Signal<Depot[] | null> = this._depots.asReadonly();

  // --- loading / error ---
  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<string | null>(null);
  readonly error: Signal<string | null> = this._error.asReadonly();

  constructor(private http: HttpClient) {}

  // =====================================================================
  // Charger les stats d’un dépôt
  // =====================================================================
  loadStats(depotId: string) {
    this._loading.set(true);
    this._error.set(null);

    // 🔥 IMPORTANT : return l’Observable !
    return this.http.get<DepotStats>(`${API_BASE}/depots/${depotId}/stats`).pipe(
      tap((stats: DepotStats) => {
        this._stats.set(stats);
        this._loading.set(false);
      }),
      catchError(err => {
        this._error.set(err.message || 'Erreur inconnue');
        this._loading.set(false);
        return of(null);
      })
    );
  }

  // =====================================================================
  // Lister tous les dépôts
  // =====================================================================
  listDepots() {
    this._loading.set(true);
    this._error.set(null);

    // 🔥 Ici aussi : return l’Observable !
    return this.http.get<Depot[]>(`${API_BASE}/depots`).pipe(
      tap((depots: Depot[]) => {
        this._depots.set(depots);
        this._loading.set(false);
      }),
      catchError(err => {
        this._error.set(err.message || 'Erreur inconnue');
        this._loading.set(false);
        return of(null);
      })
    );
  }
}
