import {UserLite} from './user-lite.model';
import {User} from './user.model';

export type DepotManager = Pick<User, '_id' | 'firstName' | 'lastName' | 'email' | 'role' | 'phone'>;

export interface Depot {
  _id: string;
  idDep?: string;
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  managerId?: string | DepotManager | null;        // idUser du gérant
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  // Statistiques (optionnel, calculées)
  stats?: {
    totalMaterials?: number;
    totalConsumables?: number;
    availableVehicles?: number;
  };
}
