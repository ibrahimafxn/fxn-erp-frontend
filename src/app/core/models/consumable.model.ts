
export interface DepotLite {
  _id: string;
  name: string;
  city?: string;
}

export interface Consumable {
  _id: string;
  idConsumable?: string;
  ref?: string;
  name: string;
  unit?: string;             // ex: 'pcs', 'box', 'meter'
  quantity?: number;
  minQuantity?: number; // quantité déjà réservée/attribuée
  idDepot?: string | DepotLite | null;
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
}
