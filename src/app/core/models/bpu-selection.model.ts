export type BpuSelection = {
  _id?: string;
  type: string;
  prestations: { code: string; unitPrice: number }[];
  createdAt?: string;
  updatedAt?: string;
};
