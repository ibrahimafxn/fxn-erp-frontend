import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, catchError, of, tap } from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class MaterialService {
  private materials$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  listMaterials(depotId?: string) {
    const url = depotId ? `${API_BASE}/materials?depot=${depotId}` : `${API_BASE}/materials`;
    return this.http.get<any[]>(url).pipe(
      tap(list => this.materials$.next(list)),
      catchError(err => {
        console.error('listMaterials error', err);
        return of([]);
      })
    );
  }

  getMaterials$() {
    return this.materials$.asObservable();
  }

  getMaterial(id: string) {
    return this.http.get(`${API_BASE}/materials/${id}`);
  }

  createMaterial(payload: any) {
    return this.http.post(`${API_BASE}/materials`, payload).pipe(
      tap(() => this.listMaterials().subscribe())
    );
  }

  updateMaterial(id: string, payload: any) {
    return this.http.put(`${API_BASE}/materials/${id}`, payload).pipe(
      tap(() => this.listMaterials().subscribe())
    );
  }

  deleteMaterial(id: string) {
    return this.http.delete(`${API_BASE}/materials/${id}`).pipe(
      tap(() => this.listMaterials().subscribe())
    );
  }

  // adjust quantity (AJOUT / SORTIE / PERTE) via API: PUT /materials/:id/adjust
  adjustQuantity(id: string, delta: number, options?: { action?: string; author?: string; createAttribution?: boolean; note?: string }) {
    return this.http.put(`${API_BASE}/materials/${id}/adjust`, {
      delta,
      action: options?.action,
      author: options?.author,
      createAttribution: options?.createAttribution,
      note: options?.note
    }).pipe(tap(() => this.listMaterials().subscribe()));
  }
}
