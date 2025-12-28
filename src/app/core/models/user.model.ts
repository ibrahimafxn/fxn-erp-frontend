import { Role } from './roles.model';

export interface User {
  /** Mongo */
  _id: string;

  /** Identité */
  firstName: string;
  lastName?: string;

  /** ✅ accès connexion */
  authEnabled?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string | Date;

  /** Contact */
  email: string;
  phone?: string;
  address?: string;

  /** Rôle / Affectations */
  role: Role;
  idDepot?: string | { _id: string; name?: string } | null;
  assignedVehicle?: string | { _id: string; plateNumber?: string; brand?: string; model?: string } | null;

  /** Auth / accès */
  username?: string;
  password?: string;
  hasCredentials?: boolean;

  /** Audit */
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
