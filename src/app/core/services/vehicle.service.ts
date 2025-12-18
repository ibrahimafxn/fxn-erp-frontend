import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, catchError, of, tap} from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private vehicles$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  listVehicles(depotId?: string) {
    const url = depotId ? `${API_BASE}/vehicles?idDepot=${depotId}` : `${API_BASE}/vehicles`;
    return this.http.get<any[]>(url).pipe(
      tap(list => this.vehicles$.next(list)),
      catchError(err => {
        console.error('listVehicles error', err);
        return of([]);
      })
    );
  }

  getVehicles$() {
    return this.vehicles$.asObservable();
  }

  getVehicle(id: string) {
    return this.http.get(`${API_BASE}/vehicles/${id}`);
  }

  createVehicle(payload: any) {
    return this.http.post(`${API_BASE}/vehicles`, payload).pipe(
      tap(() => this.listVehicles().subscribe())
    );
  }

  updateVehicle(id: string, payload: any) {
    return this.http.put(`${API_BASE}/vehicles/${id}`, payload).pipe(
      tap(() => this.listVehicles().subscribe())
    );
  }

  deleteVehicle(id: string) {
    return this.http.delete(`${API_BASE}/vehicles/${id}`).pipe(
      tap(() => this.listVehicles().subscribe())
    );
  }

  // assign vehicle (transactionnel backend)
  assignVehicle(vehicleId: string, techId: string, author?: string) {
    return this.http.put(`${API_BASE}/vehicles/${vehicleId}/assign`, { techId, author }).pipe(
      tap(() => this.listVehicles().subscribe())
    );
  }

  // release vehicle
  releaseVehicle(vehicleId: string, depotId: string, author?: string) {
    return this.http.put(`${API_BASE}/vehicles/${vehicleId}/release`, { depotId, author }).pipe(
      tap(() => this.listVehicles().subscribe())
    );
  }
}
