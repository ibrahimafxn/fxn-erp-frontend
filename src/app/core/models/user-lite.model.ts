import {Role} from './roles.model';

/**
 * Version "légère" d'un utilisateur, typiquement renvoyée par populate()
 * pour éviter de charger tout l'objet User complet.
 */
export interface UserLite {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: Role;
}
