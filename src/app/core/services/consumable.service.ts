// src/app/core/services/consumable.service.ts
import { Injectable, Signal, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Consumable } from '../models';

/** Enveloppe API standard côté backend */
type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: unknown };

/** Ton backend renvoie parfois plusieurs formes → on normalise */
type ConsumablesApiShape =
  | Consumable[] // format 1 : tableau direct
  | ApiResponse<Consumable[]> // format 2 : { success, data: [] }
  | ApiResponse<{ items: Consumable[] }>; // format 3 : { success, data: { items: [] } }

/** Même logique pour un seul item */
type ConsumableApiShape =
  | Consumable
  | ApiResponse<Consumable>;

/** Payload transactionnel backend /consumables/reserve */
export interface ReserveConsumablePayload {
  consumableId: string;
  qty: number;
  toUser?: string | null;
  fromDepot?: string | null;
  author?: string | null;
}

/** Réponse transactionnelle backend (selon ton service Node) */
export interface ReserveConsumableResult {
  consumable: Consumable;
  attribution: unknown; // si tu as un type Attribution, remplace unknown par Attribution
}

@Injectable({ providedIn: 'root' })
export class ConsumableService {
  private baseUrl = `${environment.apiBaseUrl}/consumables`;

  // -----------------------------
  // Signals (state moderne)
  // -----------------------------
  private _items = signal<Consumable[]>([]);
  readonly items: Signal<Consumable[]> = this._items.asReadonly();

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<HttpErrorResponse | null>(null);
  readonly error: Signal<HttpErrorResponse | null> = this._error.asReadonly();

  // Cache RxJS
  private _request$?: Observable<Consumable[]>;

  constructor(private http: HttpClient) {}

  // -----------------------------
  // Erreurs
  // -----------------------------
  private handleError(err: HttpErrorResponse) {
    this._error.set(err);
    this._loading.set(false);
    return throwError(() => err);
  }

  // -----------------------------
  // Normalisation API (zéro any)
  // -----------------------------
  /** Normalise une liste → renvoie TOUJOURS un tableau */
  private normalizeList(response: ConsumablesApiShape): Consumable[] {
    if (Array.isArray(response)) return response;

    const data = response.data;

    if (Array.isArray(data)) return data;

    if (data && typeof data === 'object' && 'items' in data) {
      const items = (data as { items: Consumable[] }).items;
      return Array.isArray(items) ? items : [];
    }

    return [];
  }

  /** Normalise un item → renvoie TOUJOURS un item ou null */
  private normalizeOne(response: ConsumableApiShape): Consumable | null {
    // format direct
    if (response && typeof response === 'object' && 'success' in response === false) {
      return response as Consumable;
    }

    // format enveloppé
    const wrapped = response as ApiResponse<Consumable>;
    return wrapped?.data ?? null;
  }

  // -----------------------------
  // LIST (avec filtres)
  // -----------------------------
  refresh(
    force = false,
    filter?: { idDepot?: string; q?: string }
  ): Observable<Consumable[]> {
    if (!force && this._request$) return this._request$;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();
    if (filter?.idDepot) params = params.set('idDepot', filter.idDepot);
    if (filter?.q) params = params.set('q', filter.q);

    const req$ = this.http.get<ConsumablesApiShape>(this.baseUrl, { params }).pipe(
      map((resp) => this.normalizeList(resp)),
      tap((list) => this._items.set(list)),
      tap(() => this._loading.set(false)),
      catchError((err) => this.handleError(err)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this._request$ = req$;
    return req$;
  }

  clearCache(): void {
    this._request$ = undefined;
  }

  // -----------------------------
  // GET BY ID (utile pour ton form edit)
  // -----------------------------
  getById(id: string): Observable<Consumable> {
    return this.http.get<ConsumableApiShape>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => {
        const item = this.normalizeOne(resp);
        if (!item) throw new Error('Consommable introuvable');
        return item;
      }),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  // -----------------------------
  // CRUD
  // -----------------------------
  create(payload: Partial<Consumable>): Observable<Consumable> {
    this.clearCache();

    return this.http.post<ConsumableApiShape>(this.baseUrl, payload).pipe(
      map((resp) => {
        const item = this.normalizeOne(resp);
        if (!item) throw new Error('Création: réponse invalide');
        return item;
      }),
      tap(() => this.refresh(true).subscribe({ next: () => {}, error: () => {} })),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  update(id: string, payload: Partial<Consumable>): Observable<Consumable> {
    this.clearCache();

    return this.http.put<ConsumableApiShape>(`${this.baseUrl}/${id}`, payload).pipe(
      map((resp) => {
        const item = this.normalizeOne(resp);
        if (!item) throw new Error('Update: réponse invalide');
        return item;
      }),
      tap(() => this.refresh(true).subscribe({ next: () => {}, error: () => {} })),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  remove(id: string): Observable<{ message: string }> {
    this.clearCache();

    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.refresh(true).subscribe({ next: () => {}, error: () => {} })),
      catchError((err) => this.handleError(err))
    );
  }

  // -----------------------------
  // TRANSACTION: réserve un consommable
  // -----------------------------
  reserve(payload: ReserveConsumablePayload): Observable<ReserveConsumableResult> {
    // Ne pas casser le cache de liste automatiquement si tu veux,
    // mais souvent on préfère refresh après transaction.
    return this.http.post<ReserveConsumableResult>(`${this.baseUrl}/reserve`, payload).pipe(
      tap(() => this.refresh(true).subscribe({ next: () => {}, error: () => {} })),
      catchError((err) => this.handleError(err))
    );
  }
}
