// core/models/vehicle.model.ts
export interface Vehicle {
  _id: string;
  idVehicule?: string;
  vin?: string;              // facultatif
  plateNumber?: string;
  brand?: string;
  model?: string;
  year?: number;
  state?: string;
  idDepot?: string;     // dépôt où il se trouve si non assigné
  assignedTo?: string;// idUser si en utilisation
  isAvailable?: boolean;     // helper: true si idDep present and assignedTo null
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
}
