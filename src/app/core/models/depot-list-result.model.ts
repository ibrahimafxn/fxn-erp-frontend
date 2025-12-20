import { Depot } from './depot.model';

export interface DepotListResult {
  total: number;
  page: number;
  limit: number;
  items: Depot[];
}
