import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserPreferences } from '../models';

type ApiResponse<T> = { success: boolean; data: T; message?: string };

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly baseUrl = `${environment.apiBaseUrl}/users/me/preferences`;

  constructor(private http: HttpClient) {}

  getMyPreferences(): Observable<UserPreferences> {
    return this.http.get<ApiResponse<UserPreferences>>(this.baseUrl).pipe(
      map((resp) => {
        if (!resp?.success) {
          throw resp;
        }
        return resp.data;
      })
    );
  }

  updateMyPreferences(patch: Partial<UserPreferences>): Observable<UserPreferences> {
    return this.http.put<ApiResponse<UserPreferences>>(this.baseUrl, patch).pipe(
      map((resp) => {
        if (!resp?.success) {
          throw resp;
        }
        return resp.data;
      })
    );
  }
}
