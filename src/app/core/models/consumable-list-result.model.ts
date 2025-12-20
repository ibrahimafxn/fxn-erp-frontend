import { Consumable } from './consumable.model';

export interface ConsumableListResult {
  total: number;
  page: number;
  limit: number;
  items: Consumable[];
}
