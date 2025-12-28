// src/app/core/models/vehicle-history.model.ts

export type UserLite = { _id: string; firstName?: string; lastName?: string; email?: string; role?: string };
export type DepotLite = { _id: string; name?: string; city?: string };

export type AttributionLite = {
  _id: string;
  action?: 'ATTRIBUTION' | 'REPRISE' | string;
  quantity?: number;
  note?: string;

  author?: UserLite | string | null;
  toUser?: UserLite | string | null;
  fromDepot?: DepotLite | string | null;

  createdAt?: string | Date;
};

export type VehicleHistoryItem = {
  _id: string;
  attribution?: AttributionLite | null;

  // snapshot historique (ton backend met snapshot.action, before, after, timestamp)
  snapshot?: {
    action?: string;
    before?: unknown;
    after?: unknown;
    author?: unknown;
    note?: string | null;
    timestamp?: string | Date;
  };

  createdAt?: string | Date;
};

export type VehicleHistoryResult = {
  total: number;
  page: number;
  limit: number;
  items: VehicleHistoryItem[];
};
