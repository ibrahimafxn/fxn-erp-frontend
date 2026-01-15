import { Movement } from './movement.model';

export interface MovementListResult {
  total: number;
  page: number;
  limit: number;
  items: Movement[];
}
