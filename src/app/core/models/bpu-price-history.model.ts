export type BpuPriceHistory = {
  _id?: string;
  owner?: string | null;
  type: string;
  /** Date ISO à partir de laquelle ce tarif est en vigueur */
  validFrom: string;
  prestations: { code: string; unitPrice: number }[];
  createdAt?: string;
};
