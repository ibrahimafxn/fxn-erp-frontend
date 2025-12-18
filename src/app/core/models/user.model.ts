export interface User {
  idUser?: string;
  _id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;

  email?: string;
  phone?: string;
  address?: string;

  role?: 'DIRIGEANT' | 'ADMIN' | 'GESTION_DEPOT' | 'TECHNICIEN';

  idDepot?: string | null;
  assignedVehicleId?: string | null;

  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;

  username?: string;
  password?: string;
  hasCredentials?: boolean;

  [k: string]: any;
}
