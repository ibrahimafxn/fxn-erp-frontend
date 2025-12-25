// core/models/material.model.ts
import {MaterialCategory} from './MaterialCategory.model';
export interface Material {
  _id: string;
  idMaterial?: string;
  ref?: string;              // référence interne
  name: string;
  description?: string;
  status?: string;
  category?: MaterialCategory;
  quantity?: number;         // quantité totale en stock (au dépôt)
  assignedQuantity?: number; // nombre actuellement attribué à des techniciens
  idDepot?: string | { _id: string; name?: string } | null;
  assignedTo?: string | null;// idUser si entièrement affecté / utilisé
  createdBy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  metadata?: Record<string, any>;
}

