import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ResourceListItem = {
  _id: string;
  name: string;
  type: 'MATERIAL' | 'CONSUMABLE';
  unit?: string;
  category?: string;
  minQuantity?: number;
  idDepot?: string | null;
};

@Injectable({ providedIn: 'root' })
export class ResourceListService {
  private baseUrl = `${environment.apiBaseUrl}/resources`;

  private _items = signal<ResourceListItem[]>([]);
  readonly items = this._items.asReadonly();

  constructor(private http: HttpClient) {}

  refresh(depotId?: string): Observable<{ success: boolean; data: ResourceListItem[] }> {
    let params = new HttpParams();
    if (depotId) params = params.set('depot', depotId);
    return this.http.get<{ success: boolean; data: ResourceListItem[] }>(this.baseUrl, { params });
  }

  setItems(items: ResourceListItem[]): void {
    this._items.set(items);
  }
}
