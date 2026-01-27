export type BpuEntry = {
  _id?: string;
  prestation: string;
  code: string;
  unitPrice: number;
  segment: 'AUTO' | 'SALARIE' | 'ASSOCIE';
  createdAt?: string;
  updatedAt?: string;
};
