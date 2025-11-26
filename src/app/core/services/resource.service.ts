import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  private baseUrl = '/api/resources';

  constructor(private http: HttpClient) {}

  /** Récupère les ressources d’un type et d’un dépôt */
  getResources(type: 'materials' | 'vehicles' | 'consumables', depotId?: string): Observable<any> {
    let params = depotId ? new HttpParams().set('depotId', depotId) : undefined;
    return this.http.get(`${this.baseUrl}/${type}`, { params });
  }

  /** Crée ou ajoute une ressource */
  createResource(type: 'materials' | 'vehicles' | 'consumables', data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/${type}`, data);
  }

  /** Met à jour une ressource */
  updateResource(type: 'materials' | 'vehicles' | 'consumables', resourceId: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/${type}/${resourceId}`, data);
  }

  /** Supprime une ressource */
  deleteResource(type: 'materials' | 'vehicles' | 'consumables', resourceId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${type}/${resourceId}`);
  }

  /** Attribution ou reprise d’une ressource à un utilisateur */
  assignResource(type: 'materials' | 'vehicles' | 'consumables', resourceId: string, userId: string, quantity?: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${type}/${resourceId}/assign`, { userId, quantity });
  }

  /** Récupère l’historique des mouvements pour un type de ressource */
  getResourceHistory(type: 'materials' | 'vehicles' | 'consumables', filter?: { userId?: string; depotId?: string; fromDate?: string; toDate?: string }): Observable<any> {
    let params = new HttpParams();
    if (filter?.userId) params = params.set('userId', filter.userId);
    if (filter?.depotId) params = params.set('depotId', filter.depotId);
    if (filter?.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter?.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get(`${this.baseUrl}/${type}/history`, { params });
  }
}
