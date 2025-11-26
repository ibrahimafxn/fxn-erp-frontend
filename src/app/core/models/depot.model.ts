export interface Depot {
  idDep?: string;
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  managerId?: string;        // idUser du gérant
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
