import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { BpuService } from './bpu.service';
import { BpuSelectionService } from './bpu-selection.service';
import { EffectiveBpuService } from './effective-bpu.service';
import { BpuEntry, BpuSelection, EffectiveBpuItem } from '../models';

export type ResolvedTechnicianBpuItem = {
  prestationId?: string;
  code: string;
  prestation: string;
  unitPrice: number;
};

export type ResolvedTechnicianBpuState = {
  items: ResolvedTechnicianBpuItem[];
  prices: Map<string, number>;
  selections: BpuSelection[];
  usesPersonalizedBpu: boolean;
};

@Injectable({ providedIn: 'root' })
export class TechnicianBpuResolverService {
  constructor(
    private bpuService: BpuService,
    private bpuSelectionService: BpuSelectionService,
    private effectiveBpuService: EffectiveBpuService
  ) {}

  resolve(technicianId?: string | null): Observable<ResolvedTechnicianBpuState> {
    return this.bpuSelectionService.list().pipe(
      switchMap((selections) => {
        const allSelections = selections || [];
        const fallbackSelection = this.latestSelection(allSelections);

        if (!technicianId) {
          return of({
            items: this.selectionItems(fallbackSelection),
            prices: this.selectionPrices(fallbackSelection),
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
            return {
              items: this.effectiveItems(effectiveItems),
              prices: this.effectivePrices(effectiveItems),
              selections: allSelections,
              usesPersonalizedBpu: true
            };
          }),
          catchError(() => this.resolveLegacy(allSelections))
        );
      })
    );
  }

  private resolveLegacy(selections: BpuSelection[]): Observable<ResolvedTechnicianBpuState> {
    const active = this.latestSelection(selections);
    const allowedCodes = new Set(
      (active?.prestations || []).map((item) => String(item.code || '').trim().toUpperCase()).filter(Boolean)
    );

    if (!allowedCodes.size) {
      return of({
        items: [],
        prices: new Map<string, number>(),
        selections,
        usesPersonalizedBpu: false
      });
    }

    const selectionPrices = this.selectionPrices(active);
    return this.bpuService.list().pipe(
      map((allItems: BpuEntry[]) => {
        const seen = new Set<string>();
        const items: ResolvedTechnicianBpuItem[] = [];
        const prices = new Map<string, number>();

        for (const item of allItems) {
          const code = String(item.code || '').trim().toUpperCase();
          if (!allowedCodes.has(code) || seen.has(code)) continue;
          seen.add(code);
          const unitPrice = selectionPrices.get(code) ?? 0;
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
          selections,
          usesPersonalizedBpu: false
        };
      }),
      catchError(() =>
        of({
          items: this.selectionItems(active),
          prices: selectionPrices,
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
