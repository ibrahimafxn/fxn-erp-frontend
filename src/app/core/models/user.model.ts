export interface User {
  idUser?: string;            // identifiant custom (ex: "USR-0001")
  firstName?: string;
  lastName?: string;
  displayName?: string;      // éventuellement concat first+last
  email?: string;
  phone?: string;
  address?: string;
  role?: 'DIRIGEANT' | 'ADMIN' | 'GESTION_STOCK' | 'GERANT_DEPOT' | 'TECHNICIEN' | string;
  // champs spécifiques technicien
  isAutoEntrepreneur?: boolean;
  idDepot?: string | null;   // dépôt rattaché si technicien
  assignedVehicleId?: string | null;
  // sécurité / audit
  createdBy?: string;        // idUser qui a créé l'entrée
  createdAt?: string | Date;
  updatedAt?: string | Date;
  // authentification
  username?: string;
  password?: string;
  hasCredentials?: boolean;
  // metadata libre
  [k: string]: any;
}
