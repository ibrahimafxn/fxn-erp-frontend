export interface Tool {
  idTool?: string;
  name: string;
  description?: string;
  serialNumber?: string;
  idDep?: string | null;
  assignedTo?: string | null;
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
}
