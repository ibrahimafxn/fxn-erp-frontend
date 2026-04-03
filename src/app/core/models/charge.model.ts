export type ChargeType =
  | 'VEHICULE'
  | 'LOYER'
  | 'ESSENCE'
  | 'ASSURANCE'
  | 'MATERIEL'
  | 'CONSOMMABLE'
  | 'AUTRE';

export type Charge = {
  _id: string;
  owner?: string;
  type: ChargeType;
  amount: number;
  month: string; // YYYY-MM
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};
