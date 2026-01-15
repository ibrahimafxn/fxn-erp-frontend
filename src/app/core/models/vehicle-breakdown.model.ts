export interface VehicleBreakdown {
  _id: string;
  vehicle: string;
  problemType: string;
  needsTow: boolean;
  repairMode: 'GARAGE' | 'ON_SITE';
  garageName?: string;
  garageAddress?: string;
  address: string;
  note?: string;
  author?: { _id: string; firstName?: string; lastName?: string; email?: string } | string | null;
  status?: 'OPEN' | 'RESOLVED';
  resolvedAt?: string | Date;
  resolvedNote?: string;
  resolvedGarage?: string;
  resolvedCost?: number | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface VehicleBreakdownListResult {
  total: number;
  page: number;
  limit: number;
  items: VehicleBreakdown[];
}
