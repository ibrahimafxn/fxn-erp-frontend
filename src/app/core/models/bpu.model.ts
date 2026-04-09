export type BpuEntry = {
  _id?: string;
  prestation: string;
  code: string;
  unitPrice: number;
  segment: 'AUTO' | 'SALARIE' | 'PERSONNALISE' | 'AUTRE';
  createdAt?: string;
  updatedAt?: string;
};
