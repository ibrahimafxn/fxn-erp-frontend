export type SupplyRequestStatus = 'PENDING' | 'APPROVED' | 'CANCELED';
export type SupplyRequestType = 'CONSUMABLE' | 'MATERIAL';

export type SupplyRequest = {
  _id: string;
  resourceType: SupplyRequestType;
  resource?: {
    _id: string;
    name?: string;
    unit?: string;
    quantity?: number;
    stock?: number;
    available?: number;
  } | null;
  resourceName?: string;
  quantity: number;
  note?: string;
  status: SupplyRequestStatus;
  decisionNote?: string;
  decidedAt?: string | null;
  decidedBy?: { _id: string; firstName?: string; lastName?: string; email?: string } | null;
  user?: { _id: string; firstName?: string; lastName?: string; email?: string } | null;
  depot?: { _id: string; name?: string; city?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SupplyRequestList = {
  total: number;
  page: number;
  limit: number;
  items: SupplyRequest[];
};
