import { Material } from './material.model';

export interface MaterialListResult {
  total: number;
  page: number;
  limit: number;
  items: Material[];
}
