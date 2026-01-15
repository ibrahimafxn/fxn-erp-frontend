export type MovementEndpointType = 'DEPOT' | 'USER' | 'SUPPLIER' | 'EXTERNAL' | 'NONE';
export type MovementAction = 'IN' | 'OUT' | 'TRANSFER' | 'ASSIGN' | 'RELEASE' | 'ADJUST' | 'CREATE' | 'UPDATE' | 'DELETE';
export type MovementStatus = 'COMMITTED' | 'CANCELED';

export interface MovementEndpoint {
  type: MovementEndpointType;
  id: string | null;
}

export interface Movement {
  _id: string;
  resourceType: 'MATERIAL' | 'CONSUMABLE' | 'VEHICLE';
  resourceId: string;
  resourceLabel?: string;
  resourceUnit?: string;
  action: MovementAction;
  from: MovementEndpoint;
  to: MovementEndpoint;
  fromLabel?: string;
  toLabel?: string;
  quantity: number;
  unit: string;
  author?: string | null;
  authorName?: string;
  authorEmail?: string;
  reason?: string;
  note?: string;
  status: MovementStatus;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
