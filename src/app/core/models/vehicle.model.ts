// core/models/vehicle.model.ts
export interface Vehicule {
  _id: string;
  idVehicule?: string;
  vin?: string;              // facultatif
  plateNumber?: string;
  brand?: string;
  model?: string;
  year?: number;
  state?: string;
  idDepot?: string | null;     // dépôt où il se trouve si non assigné
  assignedTo?: string | null;// idUser si en utilisation
  isAvailable?: boolean;     // helper: true si idDep present and assignedTo null
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
}
