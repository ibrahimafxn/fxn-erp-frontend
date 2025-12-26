import { Vehicle } from './vehicle.model';

export interface VehicleListResult {
  total: number;
  page: number;
  limit: number;
  items: Vehicle[];
}
