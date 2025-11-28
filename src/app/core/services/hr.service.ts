import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class HrService {
  constructor(private http: HttpClient) {}

  // POST /api/hr/docs
  addDocument(payload: any) {
    return this.http.post(`${API_BASE}/hr/docs`, payload);
  }

  // GET /api/hr/docs?user=...
  listDocs(filter?: { user?: string }) {
    const url = `${API_BASE}/hr/docs`;
    const options = filter ? { params: filter as any } : {};
    return this.http.get<any[]>(url, options).pipe(
      catchError(err => {
        console.error('listDocs error', err);
        return of([]);
      })
    );
  }

  // DELETE /api/hr/docs/:id
  deleteDoc(id: string) {
    return this.http.delete(`${API_BASE}/hr/docs/${id}`);
  }

  // Compliance checks
  checkUserCompliance(userId: string, requiredTypes: string[]) {
    return this.http.post(`${API_BASE}/hr/check-compliance`, { userId, requiredTypes });
    // (implémentation backend à prévoir — sinon implémente logic clientside)
  }
}
