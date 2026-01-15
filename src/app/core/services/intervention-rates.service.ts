import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type InterventionRate = {
  total: number;
  fxn: number;
};

export type InterventionRates = {
  racPavillon: InterventionRate;
  clem: InterventionRate;
  reconnexion: InterventionRate;
  racImmeuble: InterventionRate;
  racProS: InterventionRate;
  racProC: InterventionRate;
  racF8: InterventionRate;
  deprise: InterventionRate;
  demo: InterventionRate;
  sav: InterventionRate;
  refrac: InterventionRate;
  refcDgr: InterventionRate;
};

const DEFAULT_RATES: InterventionRates = {
  racPavillon: { total: 140, fxn: 10 },
  clem: { total: 5, fxn: 5 },
  reconnexion: { total: 45, fxn: 15 },
  racImmeuble: { total: 80, fxn: 20 },
  racProS: { total: 195, fxn: 45 },
  racProC: { total: 245, fxn: 55 },
  racF8: { total: 200, fxn: 100 },
  deprise: { total: 50, fxn: 0 },
  demo: { total: 10, fxn: 10 },
  sav: { total: 10, fxn: 10 },
  refrac: { total: 0, fxn: 0 },
  refcDgr: { total: 50, fxn: 0 }
};

@Injectable({ providedIn: 'root' })
export class InterventionRatesService {
  private readonly baseUrl = `${environment.apiBaseUrl}/interventions/pricing`;
  private readonly _rates = signal<InterventionRates>(DEFAULT_RATES);
  readonly rates = this._rates.asReadonly();

  constructor(private http: HttpClient) {}

  refresh(): Observable<InterventionRates> {
    return this.http.get<{ success: boolean; data: InterventionRates }>(this.baseUrl).pipe(
      map((resp) => this.fromApiPayload(resp.data)),
      tap((rates) => this._rates.set(rates)),
      catchError(() => {
        this._rates.set(DEFAULT_RATES);
        return of(DEFAULT_RATES);
      })
    );
  }

  save(rates: InterventionRates): Observable<InterventionRates> {
    return this.http.put<{ success: boolean; data: InterventionRates }>(this.baseUrl, this.toApiPayload(rates)).pipe(
      map((resp) => (resp.data ? this.fromApiPayload(resp.data) : rates)),
      tap((data) => this._rates.set(data))
    );
  }

  reset(): Observable<InterventionRates> {
    return this.save(DEFAULT_RATES);
  }

  private toApiPayload(rates: InterventionRates) {
    return {
      RACPAV: rates.racPavillon,
      CLEM: rates.clem,
      RECOIP: rates.reconnexion,
      RACIH: rates.racImmeuble,
      RACPRO_S: rates.racProS,
      RACPRO_C: rates.racProC,
      REPFOU_PRI: rates.racF8,
      DEPLPRISE: rates.deprise,
      DEMO: rates.demo,
      SAV: rates.sav,
      REFRAC: rates.refrac,
      REFC_DGR: rates.refcDgr
    };
  }

  private fromApiPayload(data?: Record<string, InterventionRate>): InterventionRates {
    if (!data) return DEFAULT_RATES;
    return {
      racPavillon: data['RACPAV'] ?? DEFAULT_RATES.racPavillon,
      clem: data['CLEM'] ?? DEFAULT_RATES.clem,
      reconnexion: data['RECOIP'] ?? DEFAULT_RATES.reconnexion,
      racImmeuble: data['RACIH'] ?? DEFAULT_RATES.racImmeuble,
      racProS: data['RACPRO_S'] ?? DEFAULT_RATES.racProS,
      racProC: data['RACPRO_C'] ?? DEFAULT_RATES.racProC,
      racF8: data['REPFOU_PRI'] ?? DEFAULT_RATES.racF8,
      deprise: data['DEPLPRISE'] ?? DEFAULT_RATES.deprise,
      demo: data['DEMO'] ?? DEFAULT_RATES.demo,
      sav: data['SAV'] ?? DEFAULT_RATES.sav,
      refrac: data['REFRAC'] ?? DEFAULT_RATES.refrac,
      refcDgr: data['REFC_DGR'] ?? DEFAULT_RATES.refcDgr
    };
  }
}
