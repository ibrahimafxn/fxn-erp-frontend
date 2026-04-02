export type BpuSelection = {
  _id?: string;
  owner?: string | null;
  type: string;
  prestations: { code: string; unitPrice: number }[];
  createdAt?: string;
  updatedAt?: string;
};
