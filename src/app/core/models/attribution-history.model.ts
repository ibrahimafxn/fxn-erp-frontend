// src/app/core/models/attribution-history.model.ts

import {DepotLite} from './consumable.model';
import {UserLite} from './user-lite.model';

export type AttributionLite = {
  _id: string;
  resourceType?: 'MATERIAL' | 'CONSUMABLE' | 'VEHICLE' | string;
  resourceId?: string;
  resourceModel?: 'Material' | 'Consumable' | 'Vehicle' | string;

  action?: 'ATTRIBUTION' | 'REPRISE' | 'AJOUT' | 'SORTIE' | 'PERTE' | string;
  quantity?: number;

  fromDepot?: DepotLite | string | null;
  toUser?: UserLite | string | null;
  author?: UserLite | string | null;

  note?: string;
  createdAt?: string | Date;
};

export type AttributionHistoryItem = {
  _id: string;
  attribution?: AttributionLite | null;
  snapshot?: unknown; // ton snapshot est libre (JSON)
  note?: string;
  createdAt?: string | Date;
};

export type AttributionHistoryResult = {
  total: number;
  page: number;
  limit: number;
  items: AttributionHistoryItem[];
};
