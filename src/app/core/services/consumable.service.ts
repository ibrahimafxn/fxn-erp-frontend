import { Injectable, Signal, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {AttributionHistoryResult, ConsumableListResult, Consumable} from '../models';

/**
 * Enveloppe API standard côté backend :
 * { success: boolean; data: T; message?: string; errors?: unknown }
 */
type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  errors?: unknown;
};

/**
 * Filtres de liste (alignés avec ton backend)
 * - q : recherche texte
 * - depot : compat backend (depot OU idDepot)
 * - page/limit : pagination
 */
export type ConsumableFilter = {
  q?: string;
  depot?: string;
  page?: number;
  limit?: number;
};

/**
 * Payload transactionnel backend /consumables/reserve
 */
export interface ReserveConsumablePayload {
  consumableId: string;
  qty: number;
  toUser?: string | null;
  fromDepot?: string | null;
  author?: string | null;
  note?: string | null;
}

/**
 * Réponse transactionnelle backend (selon ton service Node)
 * (Si tu as un type Attribution, remplace unknown par Attribution)
 */
export interface ReserveConsumableResult {
  consumable: Consumable;
  attribution: unknown;
}

/** Type-guard : détecte si c'est une enveloppe ApiResponse<T> */
function isApiResponse<T>(v: unknown): v is ApiResponse<T> {
  if (!v || typeof v !== 'object') return false;
  return 'success' in v && 'data' in v;
}

@Injectable({ providedIn: 'root' })
export class ConsumableService {
  private baseUrl = `${environment.apiBaseUrl}/consumables`;

  private handleError(err: HttpErrorResponse) {
    this._error.set(err);
    this._loading.set(false);
    return throwError(() => err);
  }

  // -----------------------------
  // Signals (state moderne)
  // -----------------------------

  /** Items affichables directement (table). */
  private _items = signal<Consumable[]>([]);
  readonly items: Signal<Consumable[]> = this._items.asReadonly();

  /** Résultat paginé (total/page/limit/items). */
  private _result = signal<ConsumableListResult | null>(null);
  readonly result: Signal<ConsumableListResult | null> = this._result.asReadonly();

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<HttpErrorResponse | null>(null);
  readonly error: Signal<HttpErrorResponse | null> = this._error.asReadonly();

  // Cache RxJS (cohérent avec le type renvoyé)
  private _request$?: Observable<ConsumableListResult>;

  constructor(private http: HttpClient) {}

  // -----------------------------
  // Erreurs
  // -----------------------------

  private handleHttpError(err: HttpErrorResponse): Observable<never> {
    this._error.set(err);
    this._loading.set(false);
    return throwError(() => err);
  }

  // -----------------------------
  // LISTE : paginée + filtres
  // -----------------------------

  /**
   * Charge la liste paginée depuis le backend :
   * GET /api/consumables?q=&depot=&page=&limit=
   *
   * Backend attendu :
   * { success:true, data:{ total,page,limit,items } }
   */
  refresh(force = false, filter: ConsumableFilter = {}): Observable<ConsumableListResult> {
    if (!force && this._request$) return this._request$;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();

    // q
    if (filter.q) params = params.set('q', filter.q);

    // compat : ton backend accepte depot OU idDepot (selon ton controller)
    if (filter.depot) {
      params = params.set('depot', filter.depot);
      // si tu préfères idDepot:
      // params = params.set('idDepot', filter.depot);
    }

    // pagination
    if (typeof filter.page === 'number') params = params.set('page', String(filter.page));
    if (typeof filter.limit === 'number') params = params.set('limit', String(filter.limit));

    const req$ = this.http.get<ApiResponse<ConsumableListResult>>(this.baseUrl, { params }).pipe(
      map((resp) => resp.data),
      tap((result) => {
        this._result.set(result);
        this._items.set(result.items ?? []);
      }),
      tap(() => this._loading.set(false)),
      catchError((err: HttpErrorResponse) => this.handleHttpError(err)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._request$ = req$;
    return req$;
  }

  clearCache(): void {
    this._request$ = undefined;
  }

  // -----------------------------
  // GET BY ID
  // -----------------------------

  /**
   * GET /api/consumables/:id
   * On accepte 2 formats :
   * - direct: Consumable
   * - enveloppé: {success,data:Consumable}
   */
  getById(id: string): Observable<Consumable> {
    return this.http.get<Consumable | ApiResponse<Consumable>>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => (isApiResponse<Consumable>(resp) ? resp.data : resp)),
      catchError((err: HttpErrorResponse) => this.handleHttpError(err))
    );
  }

  // -----------------------------
  // CRUD
  // -----------------------------

  create(payload: Partial<Consumable>): Observable<Consumable> {
    this.clearCache();

    return this.http.post<Consumable | ApiResponse<Consumable>>(this.baseUrl, payload).pipe(
      map((resp) => (isApiResponse<Consumable>(resp) ? resp.data : resp)),
      tap(() => {
        // refresh simple : conserve les derniers filtres côté composant,
        // donc on n'impose pas de filtre ici (le composant rappellera refresh()).
        // Si tu veux auto-refresh sans filtre: this.refresh(true).subscribe(...)
      }),
      catchError((err: HttpErrorResponse) => this.handleHttpError(err))
    );
  }

  update(id: string, payload: Partial<Consumable>): Observable<Consumable> {
    this.clearCache();

    return this.http.put<Consumable | ApiResponse<Consumable>>(`${this.baseUrl}/${id}`, payload).pipe(
      map((resp) => (isApiResponse<Consumable>(resp) ? resp.data : resp)),
      catchError((err: HttpErrorResponse) => this.handleHttpError(err))
    );
  }

  remove(id: string): Observable<ApiResponse<{ message: string }>> {
    this.clearCache();

    return this.http
      .delete<ApiResponse<{ message: string }>>(`${this.baseUrl}/${id}`)
      .pipe(catchError((err: HttpErrorResponse) => this.handleHttpError(err)));
  }

  // -----------------------------
  // TRANSACTION : réserve un consommable
  // -----------------------------

  reserve(payload: ReserveConsumablePayload): Observable<ReserveConsumableResult> {
    return this.http
      .post<ReserveConsumableResult>(`${this.baseUrl}/reserve`, payload)
      .pipe(catchError((err: HttpErrorResponse) => this.handleHttpError(err)));
  }

  releaseReservation(payload: ReserveConsumablePayload): Observable<ReserveConsumableResult> {
    return this.http
      .post<ReserveConsumableResult>(`${this.baseUrl}/reserve/release`, payload)
      .pipe(catchError((err: HttpErrorResponse) => this.handleHttpError(err)));
  }

  // -----------------------------
  // HISTORY
  // -----------------------------
  history(consumableId: string, page = 1, limit = 25): Observable<AttributionHistoryResult> {
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? limit : 25;

    let params = new HttpParams()
      .set('page', String(safePage))
      .set('limit', String(safeLimit));

    return this.http.get<ApiResponse<AttributionHistoryResult>>(`${this.baseUrl}/${consumableId}/history`, { params }).pipe(
      map(resp => resp.data),
      catchError(err => this.handleError(err))
    );
  }

  exportCsv(filter?: { q?: string; depot?: string }): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' }).pipe(
      catchError(err => this.handleError(err))
    );
  }

  exportPdf(filter?: { q?: string; depot?: string }): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/export/pdf`, { params, responseType: 'blob' }).pipe(
      catchError(err => this.handleError(err))
    );
  }

  // -----------------------------
  // ALERTS : stock minimum
  // -----------------------------
  alerts(filter: ConsumableFilter = {}): Observable<ConsumableListResult> {
    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.depot) params = params.set('depot', filter.depot);
    if (typeof filter.page === 'number') params = params.set('page', String(filter.page));
    if (typeof filter.limit === 'number') params = params.set('limit', String(filter.limit));
    params = params.set('_ts', String(Date.now()));

    return this.http.get<ApiResponse<ConsumableListResult>>(`${this.baseUrl}/alerts`, { params }).pipe(
      map((resp) => resp.data),
      catchError((err: HttpErrorResponse) => this.handleHttpError(err))
    );
  }

  alertsExportCsv(filter: ConsumableFilter = {}): Observable<Blob> {
    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/alerts/export`, { params, responseType: 'blob' }).pipe(
      catchError(err => this.handleError(err))
    );
  }

  alertsExportPdf(filter: ConsumableFilter = {}): Observable<Blob> {
    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/alerts/export/pdf`, { params, responseType: 'blob' }).pipe(
      catchError(err => this.handleError(err))
    );
  }

}
