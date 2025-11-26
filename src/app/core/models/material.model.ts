export interface Material {
  idMaterial?: string;
  ref?: string;              // référence interne
  name: string;
  description?: string;
  category?: string;
  quantity?: number;         // quantité totale en stock (au dépôt)
  assignedQuantity?: number; // nombre actuellement attribué à des techniciens
  idDep?: string | null;     // dépôt courant
  assignedTo?: string | null;// idUser si entièrement affecté / utilisé
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
}
