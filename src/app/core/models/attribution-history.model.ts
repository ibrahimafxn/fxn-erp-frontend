export interface AttributionHistoryEntry {
  id?: string;
  attributionId?: string;
  resourceType: string;
  resourceId: string;
  quantity?: number;
  previousAssignedQuantity?: number;
  newAssignedQuantity?: number;
  authorId?: string;
  action: 'ASSIGN' | 'RETURN' | 'UPDATE' | 'DELETE' | string;
  createdAt?: string | Date;
  meta?: Record<string, any>;
}
