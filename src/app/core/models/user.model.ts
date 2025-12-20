import { Role } from './roles.model';

export interface User {
  /** Mongo */
  _id: string;

  /** Identité */
  firstName: string;
  lastName?: string;

  /** Contact */
  email: string;
  phone?: string;
  address?: string;

  /** Rôle / Affectations */
  role: Role;
  idDepot?: string | null;

  /** IMPORTANT: côté backend c'est "assignedVehicle" */
  assignedVehicle?: string | null;

  /** Auth / accès */
  username?: string;
  password?: string;
  hasCredentials?: boolean;

  /** Audit */
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
