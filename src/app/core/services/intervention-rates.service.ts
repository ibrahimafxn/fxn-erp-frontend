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
  racPavillon: InterventionRate;    // RAC_PBO_SOUT
  racAerien: InterventionRate;      // RAC_PBO_AERIEN
  racFacade: InterventionRate;      // RAC_PBO_FACADE
  clem: InterventionRate;           // CLEM
  reconnexion: InterventionRate;    // RECOIP
  racImmeuble: InterventionRate;    // RACIM (ex RACIH)
  racProS: InterventionRate;        // PLV_PRO_S (ex RACPRO_S)
  racProC: InterventionRate;        // PLV_PRO_C (ex RACPRO_C)
  racF8: InterventionRate;          // FOURREAU_CASSE_PRIVE (ex REPFOU_PRI)
  fourreauBeton: InterventionRate;  // FOURREAU_CASSE_BETON (nouveau)
  prestaCompl: InterventionRate;    // PRESTA_COMPL
  deplacementPrise: InterventionRate; // DEPLACEMENT_PRISE (ex DEPLPRISE)
  demo: InterventionRate;           // DEMO
  sav: InterventionRate;            // SAV
  savExp: InterventionRate;         // SAV_EXP
  deplacementOffert: InterventionRate;  // DEPLACEMENT_OFFERT
  deplacementATort: InterventionRate;   // DEPLACEMENT_A_TORT
  swapEquipement: InterventionRate;     // SWAP_EQUIPEMENT
  refrac: InterventionRate;         // REFRAC
  refcDgr: InterventionRate;        // REFRAC_DEGRADATION (ex REFC_DGR)
  cableSl: InterventionRate;        // CABLE_SL (ex CABLE_PAV_1/2/3/4)
  bifibre: InterventionRate;        // BIFIBRE (nouveau)
  nacelle: InterventionRate;        // NACELLE (nouveau)
};

const DEFAULT_RATES: InterventionRates = {
  racPavillon: { total: 140, fxn: 10 },
  racAerien: { total: 215, fxn: 10 },
  racFacade: { total: 160, fxn: 10 },
  clem: { total: 5, fxn: 5 },
  reconnexion: { total: 35, fxn: 15 },
  racImmeuble: { total: 65, fxn: 20 },
  racProS: { total: 50, fxn: 0 },
  racProC: { total: 100, fxn: 0 },
  racF8: { total: 90, fxn: 0 },
  fourreauBeton: { total: 450, fxn: 0 },
  prestaCompl: { total: 50, fxn: 0 },
  deplacementPrise: { total: 20, fxn: 0 },
  demo: { total: 10, fxn: 10 },
  sav: { total: 10, fxn: 10 },
  savExp: { total: 10, fxn: 0 },
  deplacementOffert: { total: 10, fxn: 0 },
  deplacementATort: { total: 10, fxn: 0 },
  swapEquipement: { total: 10, fxn: 0 },
  refrac: { total: 50, fxn: 0 },
  refcDgr: { total: 50, fxn: 0 },
  cableSl: { total: 0.30, fxn: 0 },
  bifibre: { total: 5, fxn: 0 },
  nacelle: { total: -80, fxn: 0 },
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
      RAC_PBO_SOUT: rates.racPavillon,
      RAC_PBO_AERIEN: rates.racAerien,
      RAC_PBO_FACADE: rates.racFacade,
      CLEM: rates.clem,
      RECOIP: rates.reconnexion,
      RACIM: rates.racImmeuble,
      PLV_PRO_S: rates.racProS,
      PLV_PRO_C: rates.racProC,
      FOURREAU_CASSE_PRIVE: rates.racF8,
      FOURREAU_CASSE_BETON: rates.fourreauBeton,
      PRESTA_COMPL: rates.prestaCompl,
      DEPLACEMENT_PRISE: rates.deplacementPrise,
      DEMO: rates.demo,
      SAV: rates.sav,
      SAV_EXP: rates.savExp,
      DEPLACEMENT_OFFERT: rates.deplacementOffert,
      DEPLACEMENT_A_TORT: rates.deplacementATort,
      SWAP_EQUIPEMENT: rates.swapEquipement,
      REFRAC: rates.refrac,
      REFRAC_DEGRADATION: rates.refcDgr,
      CABLE_SL: rates.cableSl,
      BIFIBRE: rates.bifibre,
      NACELLE: rates.nacelle,
    };
  }

  private fromApiPayload(data?: Record<string, InterventionRate>): InterventionRates {
    if (!data) return DEFAULT_RATES;
    return {
      // RAC_PBO_SOUT remplace RACPAV — compatibilité ascendante
      racPavillon: data['RAC_PBO_SOUT'] ?? data['RACPAV'] ?? DEFAULT_RATES.racPavillon,
      racAerien: data['RAC_PBO_AERIEN'] ?? DEFAULT_RATES.racAerien,
      racFacade: data['RAC_PBO_FACADE'] ?? DEFAULT_RATES.racFacade,
      clem: data['CLEM'] ?? DEFAULT_RATES.clem,
      reconnexion: data['RECOIP'] ?? DEFAULT_RATES.reconnexion,
      // RACIM remplace RACIH — compatibilité ascendante
      racImmeuble: data['RACIM'] ?? data['RACIH'] ?? DEFAULT_RATES.racImmeuble,
      // PLV_PRO_S remplace RACPRO_S — compatibilité ascendante
      racProS: data['PLV_PRO_S'] ?? data['RACPRO_S'] ?? DEFAULT_RATES.racProS,
      // PLV_PRO_C remplace RACPRO_C — compatibilité ascendante
      racProC: data['PLV_PRO_C'] ?? data['RACPRO_C'] ?? DEFAULT_RATES.racProC,
      // FOURREAU_CASSE_PRIVE remplace REPFOU_PRI — compatibilité ascendante
      racF8: data['FOURREAU_CASSE_PRIVE'] ?? data['REPFOU_PRI'] ?? DEFAULT_RATES.racF8,
      fourreauBeton: data['FOURREAU_CASSE_BETON'] ?? DEFAULT_RATES.fourreauBeton,
      prestaCompl: data['PRESTA_COMPL'] ?? DEFAULT_RATES.prestaCompl,
      // DEPLACEMENT_PRISE remplace DEPLPRISE — compatibilité ascendante
      deplacementPrise: data['DEPLACEMENT_PRISE'] ?? data['DEPLPRISE'] ?? DEFAULT_RATES.deplacementPrise,
      demo: data['DEMO'] ?? DEFAULT_RATES.demo,
      sav: data['SAV'] ?? DEFAULT_RATES.sav,
      savExp: data['SAV_EXP'] ?? DEFAULT_RATES.savExp,
      deplacementOffert: data['DEPLACEMENT_OFFERT'] ?? DEFAULT_RATES.deplacementOffert,
      deplacementATort: data['DEPLACEMENT_A_TORT'] ?? DEFAULT_RATES.deplacementATort,
      swapEquipement: data['SWAP_EQUIPEMENT'] ?? DEFAULT_RATES.swapEquipement,
      refrac: data['REFRAC'] ?? DEFAULT_RATES.refrac,
      // REFRAC_DEGRADATION remplace REFC_DGR — compatibilité ascendante
      refcDgr: data['REFRAC_DEGRADATION'] ?? data['REFC_DGR'] ?? DEFAULT_RATES.refcDgr,
      // CABLE_SL remplace CABLE_PAV_1/2/3/4 — compatibilité ascendante (on prend PAV_1 comme ref)
      cableSl: data['CABLE_SL'] ?? data['CABLE_PAV_1'] ?? DEFAULT_RATES.cableSl,
      bifibre: data['BIFIBRE'] ?? DEFAULT_RATES.bifibre,
      nacelle: data['NACELLE'] ?? DEFAULT_RATES.nacelle,
    };
  }
}
