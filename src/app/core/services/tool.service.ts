import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, catchError, of, tap} from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

@Injectable({ providedIn: 'root' })
export class ToolService {
  private tools$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  listTools() {
    return this.http.get<any[]>(`${API_BASE}/tools`).pipe(
      tap(list => this.tools$.next(list)),
      catchError(err => {
        console.error('listTools error', err);
        return of([]);
      })
    );
  }

  getTools$() {
    return this.tools$.asObservable();
  }

  createTool(payload: any) {
    return this.http.post(`${API_BASE}/tools`, payload).pipe(
      tap(() => this.listTools().subscribe())
    );
  }

  updateTool(id: string, payload: any) {
    return this.http.put(`${API_BASE}/tools/${id}`, payload).pipe(
      tap(() => this.listTools().subscribe())
    );
  }

  deleteTool(id: string) {
    return this.http.delete(`${API_BASE}/tools/${id}`).pipe(
      tap(() => this.listTools().subscribe())
    );
  }
}
