import { Injectable, signal } from '@angular/core';

export type InterventionRate = {
  fxn: number;
  tech: number;
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

const STORAGE_KEY = 'fxn_intervention_rates';

const DEFAULT_RATES: InterventionRates = {
  racPavillon: { fxn: 10, tech: 130 },
  clem: { fxn: 5, tech: 0 },
  reconnexion: { fxn: 15, tech: 30 },
  racImmeuble: { fxn: 20, tech: 60 },
  racProS: { fxn: 45, tech: 150 },
  racProC: { fxn: 55, tech: 190 },
  racF8: { fxn: 100, tech: 100 },
  deprise: { fxn: 0, tech: 50 },
  demo: { fxn: 10, tech: 0 },
  sav: { fxn: 10, tech: 0 },
  refrac: { fxn: 0, tech: 0 },
  refcDgr: { fxn: 0, tech: 50 }
};

@Injectable({ providedIn: 'root' })
export class InterventionRatesService {
  private readonly _rates = signal<InterventionRates>(this.load());
  readonly rates = this._rates.asReadonly();

  save(rates: InterventionRates): void {
    this._rates.set(rates);
    this.persist(rates);
  }

  reset(): void {
    this._rates.set(DEFAULT_RATES);
    this.persist(DEFAULT_RATES);
  }

  private load(): InterventionRates {
    if (typeof localStorage === 'undefined') return DEFAULT_RATES;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_RATES;
      const parsed = JSON.parse(raw) as Partial<InterventionRates>;
      return {
        ...DEFAULT_RATES,
        ...parsed
      };
    } catch {
      return DEFAULT_RATES;
    }
  }

  private persist(rates: InterventionRates): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rates));
    } catch {
      // ignore storage errors
    }
  }
}
