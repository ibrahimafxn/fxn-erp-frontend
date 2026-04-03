export interface Prestation {
  _id: string;
  code: string;
  designation: string;
  prix: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrestationListResult {
  total: number;
  page: number;
  limit: number;
  items: Prestation[];
}
