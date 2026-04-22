import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { BpuService } from './bpu.service';
import { BpuSelectionService } from './bpu-selection.service';
import { EffectiveBpuService } from './effective-bpu.service';
import { BpuEntry, BpuSelection, BpuPriceHistory, EffectiveBpuItem } from '../models';

export type ResolvedTechnicianBpuItem = {
  prestationId?: string;
  code: string;
  prestation: string;
  unitPrice: number;
};

export type ResolvedTechnicianBpuState = {
  items: ResolvedTechnicianBpuItem[];
  prices: Map<string, number>;
  /** Prix courants indexés par date (triés validFrom DESC) */
  priceHistory: BpuPriceHistory[];
  selections: BpuSelection[];
  usesPersonalizedBpu: boolean;
};

/**
 * Retourne la Map<code, unitPrice> en vigueur à la date donnée,
 * en cherchant dans l'historique le snapshot le plus récent dont validFrom ≤ date.
 * Si aucun snapshot n'est antérieur, retourne les prix du snapshot le plus ancien.
 * Si l'historique est vide, retourne la map courante (fallback).
 */
export function pricesForDate(
  history: BpuPriceHistory[],
  reportDate: string | Date | null | undefined,
  fallback: Map<string, number>
): Map<string, number> {
  if (!history.length) return fallback;

  const normalizeDay = (value: string | Date | null | undefined): number => {
    if (!value) return 0;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  const ts = normalizeDay(reportDate);

  // history est trié validFrom DESC côté backend
  // On cherche le premier (= le plus récent) dont validFrom ≤ ts
  const snapshot = history.find((h) => normalizeDay(h.validFrom) <= ts) ?? history[history.length - 1];

  const map = new Map<string, number>();
  for (const { code, unitPrice } of snapshot.prestations) {
    const key = String(code || '').trim().toUpperCase();
    if (key) map.set(key, Number(unitPrice ?? 0));
  }
  return map;
}

@Injectable({ providedIn: 'root' })
export class TechnicianBpuResolverService {
  constructor(
    private bpuService: BpuService,
    private bpuSelectionService: BpuSelectionService,
    private effectiveBpuService: EffectiveBpuService
  ) {}

  resolve(technicianId?: string | null): Observable<ResolvedTechnicianBpuState> {
    const historyOwner = technicianId ?? null;
    const selectionOwner = technicianId ?? null;

    return forkJoin({
      selections: this.bpuSelectionService.list({ owner: selectionOwner }),
      history: this.bpuSelectionService.listHistory({ owner: historyOwner }).pipe(catchError(() => of([])))
    }).pipe(
      switchMap(({ selections, history }) => {
        const allSelections = selections || [];
        const fallbackSelection = this.latestSelection(allSelections);
        const priceHistory = history || [];

        if (!technicianId) {
          const selectionPrices = this.selectionPrices(fallbackSelection);
          const prices = pricesForDate(priceHistory, new Date(), selectionPrices);
          return of({
            items: this.selectionItems(fallbackSelection).map((item) => ({
              ...item,
              unitPrice: prices.get(String(item.code || '').trim().toUpperCase()) ?? item.unitPrice
            })),
            prices,
            priceHistory,
            selections: allSelections,
            usesPersonalizedBpu: false
          });
        }

        return this.effectiveBpuService.getTechnicianEffectiveBpu(technicianId).pipe(
          map((items) => {
            const effectiveItems = items || [];
            if (!effectiveItems.length) {
              throw new Error('EMPTY_EFFECTIVE_BPU');
            }
            const usesPersonalizedBpu = effectiveItems.some(item => item.source === 'OVERRIDE');
            const prices = pricesForDate(priceHistory, new Date(), this.effectivePrices(effectiveItems));
            return {
              items: this.effectiveItems(effectiveItems).map((item) => ({
                ...item,
                unitPrice: prices.get(String(item.code || '').trim().toUpperCase()) ?? item.unitPrice
              })),
              prices,
              priceHistory,
              selections: allSelections,
              usesPersonalizedBpu
            };
          }),
          catchError(() => this.resolveLegacy(allSelections, priceHistory))
        );
      })
    );
  }

  private resolveLegacy(selections: BpuSelection[], priceHistory: BpuPriceHistory[] = []): Observable<ResolvedTechnicianBpuState> {
    const active = this.latestSelection(selections);
    const allowedCodes = new Set(
      (active?.prestations || []).map((item) => String(item.code || '').trim().toUpperCase()).filter(Boolean)
    );

    if (!allowedCodes.size) {
      return of({
        items: [],
        prices: new Map<string, number>(),
        priceHistory,
        selections,
        usesPersonalizedBpu: false
      });
    }

    const selectionPrices = this.selectionPrices(active);
    const currentPrices = pricesForDate(priceHistory, new Date(), selectionPrices);
    return this.bpuService.list().pipe(
      map((allItems: BpuEntry[]) => {
        const seen = new Set<string>();
        const items: ResolvedTechnicianBpuItem[] = [];
        const prices = new Map<string, number>();

        for (const item of allItems) {
          const code = String(item.code || '').trim().toUpperCase();
          if (!allowedCodes.has(code) || seen.has(code)) continue;
          seen.add(code);
          const unitPrice = currentPrices.get(code) ?? selectionPrices.get(code) ?? 0;
          prices.set(code, unitPrice);
          items.push({
            code,
            prestation: item.prestation || item.code || code,
            unitPrice
          });
        }

        return {
          items,
          prices,
          priceHistory,
          selections,
          usesPersonalizedBpu: false
        };
      }),
      catchError(() =>
        of({
          items: this.selectionItems(active).map((item) => ({
            ...item,
            unitPrice: currentPrices.get(String(item.code || '').trim().toUpperCase()) ?? item.unitPrice
          })),
          prices: currentPrices,
          priceHistory,
          selections,
          usesPersonalizedBpu: false
        })
      )
    );
  }

  private latestSelection(selections: BpuSelection[]): BpuSelection | null {
    const sorted = [...selections].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
    return sorted[0] ?? null;
  }

  private selectionPrices(selection: BpuSelection | null): Map<string, number> {
    const prices = new Map<string, number>();
    for (const item of selection?.prestations || []) {
      const code = String(item.code || '').trim().toUpperCase();
      if (code) prices.set(code, Number(item.unitPrice ?? 0));
    }
    return prices;
  }

  private selectionItems(selection: BpuSelection | null): ResolvedTechnicianBpuItem[] {
    return (selection?.prestations || [])
      .map((item) => {
        const code = String(item.code || '').trim().toUpperCase();
        if (!code) return null;
        return {
          code,
          prestation: code,
          unitPrice: Number(item.unitPrice ?? 0)
        };
      })
      .filter((item): item is ResolvedTechnicianBpuItem => Boolean(item));
  }

  private effectivePrices(items: EffectiveBpuItem[]): Map<string, number> {
    const prices = new Map<string, number>();
    for (const item of items) {
      const code = String(item.code || '').trim().toUpperCase();
      if (code) prices.set(code, Number(item.prixUnitaire ?? 0));
    }
    return prices;
  }

  private effectiveItems(items: EffectiveBpuItem[]): ResolvedTechnicianBpuItem[] {
    return items
      .filter((item) => !!String(item.code || '').trim())
      .sort((a, b) => Number(a.ordreAffichage ?? 0) - Number(b.ordreAffichage ?? 0))
      .map((item) => {
        const code = String(item.code || '').trim().toUpperCase();
        return {
          prestationId: item.prestationId,
          code,
          prestation: item.libelle || code,
          unitPrice: Number(item.prixUnitaire ?? 0)
        };
      });
  }
}
