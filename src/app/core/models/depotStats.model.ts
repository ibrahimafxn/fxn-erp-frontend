// DepotStats
export interface DepotStats {
  technicians: number;
  vehicles: number;
  consumables: number;
  materials: number;
  lowStockConsumables?: number;
  lowStockMaterials?: number;
  vehicleAlerts?: number;
}
