// core/services/vehicle.service.ts
import {Injectable, Signal, signal} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError, map, shareReplay, tap} from 'rxjs/operators';
import {environment} from '../../environments/environment';
import {Vehicle} from '../models';
import {VehicleListResult} from '../models';
import {VehicleHistoryResult} from '../models/vehicle-history.model';
type TxApiResponse = ApiResponse<unknown> | unknown;
type ApiResponse<T> = { success: boolean; data: T; message?: string; errors?: unknown };

export type VehicleFilter = {
  q?: string;
  depot?: string; // compat: depot ou idDepot
  page?: number;
  limit?: number;
};

// Backend peut répondre:
// 1) tableau direct
// 2) { success:true, data:[...] }
// 3) { success:true, data:{total,page,limit,items:[...]} }
type VehiclesApiShape =
  | Vehicle[]
  | ApiResponse<Vehicle[]>
  | ApiResponse<VehicleListResult>;

type VehicleApiShape =
  | Vehicle
  | ApiResponse<Vehicle>;

export interface AssignVehiclePayload {
  techId: string;
  author?: string; // id user qui fait l'action (optionnel)
  note?: string;   // optionnel
}

export interface ReleaseVehiclePayload {
  depotId: string;
  author?: string;
  note?: string;
}

@Injectable({providedIn: 'root'})
export class VehicleService {
  private baseUrl = `${environment.apiBaseUrl}/vehicles`;

  private _loading = signal(false);
  readonly loading: Signal<boolean> = this._loading.asReadonly();

  private _error = signal<HttpErrorResponse | null>(null);
  readonly error: Signal<HttpErrorResponse | null> = this._error.asReadonly();

  private _result = signal<VehicleListResult | null>(null);
  readonly result: Signal<VehicleListResult | null> = this._result.asReadonly();

  private _request$?: Observable<VehicleListResult>;

  constructor(private http: HttpClient) {
  }

  private handleError(err: HttpErrorResponse) {
    this._error.set(err);
    this._loading.set(false);
    return throwError(() => err);
  }

  clearCache(): void {
    this._request$ = undefined;
  }

  // -----------------------------
  // Normalisation (0 any)
  // -----------------------------
  private isApiResponse<T>(x: unknown): x is ApiResponse<T> {
    return !!x && typeof x === 'object' && 'success' in x && 'data' in x;
  }
  /** Convertit (plate/km) -> (plateNumber/year/...) si besoin */
  private normalizeVehicle(v: Vehicle): Vehicle {
    // Certains backends utilisent "plate" au lieu de "plateNumber"
    const plate =
      (v as unknown as { plate?: unknown }).plate;

    const plateNumber = v.plateNumber ?? (typeof plate === 'string' ? plate : undefined);

    // Le backend peut avoir "model" (string) et toi aussi -> ok.
    return {
      ...v,
      plateNumber,
    };
  }
  private normalizeListResponse(resp: VehiclesApiShape, fallbackPage: number, fallbackLimit: number): VehicleListResult {
    // format 1: tableau direct
    if (Array.isArray(resp)) {
      const items = resp.map((x) => this.normalizeVehicle(x));
      return {total: items.length, page: fallbackPage, limit: fallbackLimit, items};
    }

    // format enveloppé
    if (this.isApiResponse<unknown>(resp)) {
      const data = resp.data;

      // data = tableau
      if (Array.isArray(data)) {
        const items = data.map((x) => this.normalizeVehicle(x));
        return {total: items.length, page: fallbackPage, limit: fallbackLimit, items};
      }

      // data = { total,page,limit,items }
      if (data && typeof data === 'object' && 'items' in data) {
        const d = data as VehicleListResult;
        const items = (d.items ?? []).map((x) => this.normalizeVehicle(x));
        return {
          total: d.total,
          page: d.page,
          limit: d.limit,
          items
        };
      }
    }

    return {total: 0, page: fallbackPage, limit: fallbackLimit, items: []};
  }
  private normalizeOneResponse(resp: VehicleApiShape): Vehicle | null {
    // format direct
    if (resp && typeof resp === 'object' && !this.isApiResponse<unknown>(resp)) {
      return this.normalizeVehicle(resp as Vehicle
      );
    }

    // format enveloppé
    if (this.isApiResponse<Vehicle>(resp)) {
      return resp.data ? this.normalizeVehicle(resp.data) : null;
    }

    return null;
  }

  // -----------------------------
  // LIST paginée + filtres
  // -----------------------------
  refresh(force = false, filter?: VehicleFilter): Observable<VehicleListResult> {
    if (!force && this._request$) return this._request$;

    const safePage = filter?.page && filter.page > 0 ? filter.page : 1;
    const safeLimit = filter?.limit && filter.limit > 0 ? filter.limit : 25;

    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams();

    // compat back: idDepot (déjà existant) + depot
    if (filter?.depot) params = params.set('idDepot', filter.depot);

    // si ton backend n’a pas encore q/page/limit => il ignorera, pas grave
    if (filter?.q) params = params.set('q', filter.q);
    params = params.set('page', String(safePage));
    params = params.set('limit', String(safeLimit));

    const req$ = this.http.get<VehiclesApiShape>(this.baseUrl, {params}).pipe(
      map((resp) => this.normalizeListResponse(resp, safePage, safeLimit)),
      tap((result) => this._result.set(result)),
      tap(() => this._loading.set(false)),
      catchError((err) => this.handleError(err))
    );

    this._request$ = req$.pipe(shareReplay({bufferSize: 1, refCount: true}));
    return this._request$;
  }

  // -----------------------------
  // GET BY ID
  // -----------------------------
  getById(id: string): Observable<Vehicle> {
    return this.http.get<VehicleApiShape>(`${this.baseUrl}/${id}`).pipe(
      map((resp) => {
        const v = this.normalizeOneResponse(resp);
        if (!v) throw new Error('Véhicule introuvable');
        return v;
      }),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  // -----------------------------
  // CRUD
  // -----------------------------
  create(payload: Partial<Vehicle>): Observable<Vehicle> {
    this.clearCache();
    return this.http.post<VehicleApiShape>(this.baseUrl, payload).pipe(
      map((resp) => {
        const v = this.normalizeOneResponse(resp);
        if (!v) throw new Error('Création: réponse invalide');
        return v;
      }),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }
  update(id: string, payload: Partial<Vehicle>): Observable<Vehicle> {
    this.clearCache();
    return this.http.put<VehicleApiShape>(`${this.baseUrl}/${id}`, payload).pipe(
      map((resp) => {
        const v = this.normalizeOneResponse(resp);
        if (!v) throw new Error('Update: réponse invalide');
        return v;
      }),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }
  remove(id: string): Observable<{ _id: string } | { message: string }> {
    this.clearCache();
    return this.http.delete<{ _id: string } | { message: string }>(`${this.baseUrl}/${id}`).pipe(
      catchError((err) => this.handleError(err))
    );
  }

  // -----------------------------
  // HISTORY
  // -----------------------------
  history(vehicleId: string, page = 1, limit = 25): Observable<VehicleHistoryResult> {
    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? limit : 25;

    let params = new HttpParams()
      .set('page', String(safePage))
      .set('limit', String(safeLimit));

    return this.http.get<ApiResponse<VehicleHistoryResult>>(`${this.baseUrl}/${vehicleId}/history`, { params }).pipe(
      map((resp) => resp.data),
      catchError((err) => this.handleError(err))
    );
  }

  exportCsv(filter?: VehicleFilter): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' }).pipe(
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  exportPdf(filter?: VehicleFilter): Observable<Blob> {
    let params = new HttpParams();
    if (filter?.q) params = params.set('q', filter.q);
    if (filter?.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/export/pdf`, { params, responseType: 'blob' }).pipe(
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  alerts(filter: VehicleFilter = {}): Observable<VehicleListResult> {
    const safePage = filter.page && filter.page > 0 ? filter.page : 1;
    const safeLimit = filter.limit && filter.limit > 0 ? filter.limit : 25;

    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.depot) params = params.set('depot', filter.depot);
    params = params.set('page', String(safePage));
    params = params.set('limit', String(safeLimit));

    return this.http.get<VehiclesApiShape>(`${this.baseUrl}/alerts`, { params }).pipe(
      map((resp) => this.normalizeListResponse(resp, safePage, safeLimit)),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  alertsExportCsv(filter: VehicleFilter = {}): Observable<Blob> {
    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/alerts/export`, { params, responseType: 'blob' }).pipe(
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  alertsExportPdf(filter: VehicleFilter = {}): Observable<Blob> {
    let params = new HttpParams();
    if (filter.q) params = params.set('q', filter.q);
    if (filter.depot) params = params.set('depot', filter.depot);
    return this.http.get(`${this.baseUrl}/alerts/export/pdf`, { params, responseType: 'blob' }).pipe(
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }

  /** PUT /api/vehicles/:id/assign  { techId, author?, note? } */
  assignVehicle(vehicleId: string, payload: AssignVehiclePayload): Observable<Vehicle> {
    // PUT /api/vehicles/:id/assign  { techId, author?, note? }
    return this.http.put<TxApiResponse>(`${this.baseUrl}/${vehicleId}/assign`, payload).pipe(
      map((resp) => {
        // Le backend recommandé: { success:true, data: Vehicle, meta? }
        // Mais on reste tolérant (0 any) :
        const v = this.normalizeOneResponse(resp as VehicleApiShape);
        if (v) return v;

        // fallback: si backend renvoie {data:{vehicle:Vehicle}}
        if (this.isApiResponse<unknown>(resp)) {
          const data = resp.data;
          if (data && typeof data === 'object' && 'vehicle' in data) {
            const vehicle = (data as { vehicle?: Vehicle }).vehicle;
            if (vehicle) return this.normalizeVehicle(vehicle);
          }
        }

        throw new Error('Assign: réponse invalide');
      }),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }
  /** PUT /api/vehicles/:id/release { depotId, author?, note? } */
  releaseVehicle(vehicleId: string, payload: ReleaseVehiclePayload): Observable<Vehicle> {
    // PUT /api/vehicles/:id/release  { depotId, author?, note? }
    return this.http.put<TxApiResponse>(`${this.baseUrl}/${vehicleId}/release`, payload).pipe(
      map((resp) => {
        const v = this.normalizeOneResponse(resp as VehicleApiShape);
        if (v) return v;

        if (this.isApiResponse<unknown>(resp)) {
          const data = resp.data;
          if (data && typeof data === 'object' && 'vehicle' in data) {
            const vehicle = (data as { vehicle?: Vehicle }).vehicle;
            if (vehicle) return this.normalizeVehicle(vehicle);
          }
        }

        throw new Error('Release: réponse invalide');
      }),
      catchError((err) => this.handleError(err as HttpErrorResponse))
    );
  }}
