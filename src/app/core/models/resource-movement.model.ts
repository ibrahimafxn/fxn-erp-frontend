export type MovementKind = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

export interface ResourceMovement {
  id?: string;
  kind: MovementKind;
  resourceType: 'MATERIAL' | 'CONSUMABLE' | 'VEHICULE' | 'TOOL' | string;
  resourceId: string;
  quantity?: number;
  fromDepotId?: string | null;
  toDepotId?: string | null;
  userId?: string | null;     // opérateur qui a réalisé le mouvement
  reason?: string;
  createdAt?: string | Date;
}
