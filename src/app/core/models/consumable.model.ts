export interface Consumable {
  idConsumable?: string;
  ref?: string;
  name: string;
  unit?: string;             // ex: 'pcs', 'box', 'meter'
  quantity?: number;
  reservedQuantity?: number; // quantité déjà réservée/attribuée
  idDep?: string | null;
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
}
