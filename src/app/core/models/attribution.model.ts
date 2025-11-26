export type AttributionType = 'ASSIGN' | 'RETURN' | 'TRANSFER';

export interface Attribution {
  idAttribution?: string;
  resourceType: 'MATERIAL' | 'CONSUMABLE' | 'VEHICULE' | 'TOOL' | string;
  resourceId: string;         // idMaterial / idConsumable / idVehicule / idTool
  quantity?: number;          // pour véhicules, 1 ou undefined
  fromDepotId?: string | null;
  toUserId?: string | null;   // technicien destinataire (pour assign)
  authorId?: string;          // idUser qui fait l'opération
  type: AttributionType;
  comment?: string;
  createdAt?: string | Date;
}
