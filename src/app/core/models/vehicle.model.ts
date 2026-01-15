// core/models/vehicle.model.ts
import { UserLite } from './user-lite.model';
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
  assignedTo?: string | UserLite | null; // idUser ou user populate
  isAvailable?: boolean;     // helper: true si idDep present and assignedTo null
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
  breakdown?: {
    _id: string;
    problemType: string;
    needsTow: boolean;
    repairMode: 'GARAGE' | 'ON_SITE';
    garageName?: string;
    garageAddress?: string;
    address: string;
    createdAt?: string | Date;
  } | null;
}
