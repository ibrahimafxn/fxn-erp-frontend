import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type OsirisEquipmentItem = {
  _id: string;
  serialNumber: string;
  technicianRaw: string;
  technicianId: string | null;
  equipmentType: string;
  codeProcable: string;
  lot: string;
  dateEntree: string | null;
  categorie: string;
  importedAt: string;
};

export type OsirisEquipmentEntry = { type: string; count: number };

export type OsirisTechnicianSummary = {
  technicianId: string | null;
  technicianRaw: string;
  firstName?: string;
  lastName?: string;
  equipment: OsirisEquipmentEntry[];
  total: number;
};

export type OsirisImportAuthor = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
} | string | null;

export type OsirisEquipmentSummary = OsirisTechnicianSummary[] & {
  importedAt?: string | null;
  createdAt?: string | null;
  importedBy?: OsirisImportAuthor;
};

export type OsirisMyEquipment = {
  equipment: Array<OsirisEquipmentEntry & { codeProcable: string; categorie: string }>;
  total: number;
  importedAt?: string | null;
  createdAt?: string | null;
  importedBy?: OsirisImportAuthor;
};

export type OsirisImportResult = {
  total: number;
  imported: number;
  updated: number;
  unchanged: number;
  errors: Array<{ serialNumber: string; error: string }>;
};

export type OsirisEquipmentList = {
  items: OsirisEquipmentItem[];
  total: number;
  page: number;
  limit: number;
};

@Injectable({ providedIn: 'root' })
export class OsirisEquipmentService {
  private readonly base = `${environment.apiBaseUrl}/osiris-equipment`;

  static isIgnoredType(type: string | null | undefined): boolean {
    const normalized = String(type || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[\s_-]+/g, ' ')
      .trim();
    return normalized.includes('gen8 ftth sfrbusiness');
  }

  constructor(private http: HttpClient) {}

  /** Importe un CSV Osiris (texte brut, séparateur ;). */
  importCsv(csvContent: string): Observable<{ success: boolean; data: OsirisImportResult }> {
    return this.http.post<{ success: boolean; data: OsirisImportResult }>(
      `${this.base}/import`,
      csvContent,
      { headers: { 'Content-Type': 'text/csv' } }
    );
  }

  /** Re-mappe technicianId sur tous les enregistrements existants (après fix encodage). */
  reResolve(): Observable<{ success: boolean; data: { total: number; resolved: number; unresolved: number } }> {
    return this.http.post<{ success: boolean; data: { total: number; resolved: number; unresolved: number } }>(
      `${this.base}/re-resolve`,
      null
    );
  }

  /** Supprime tout le stock Osiris (avant réimport complet). */
  deleteAll(): Observable<{ success: boolean; data: { deleted: number } }> {
    return this.http.delete<{ success: boolean; data: { deleted: number } }>(`${this.base}/all`);
  }

  /** Résumé global par technicien (admin). */
  summary(): Observable<{ success: boolean; data: OsirisEquipmentSummary }> {
    return this.http.get<{ success: boolean; data: OsirisEquipmentSummary }>(`${this.base}/summary`);
  }

  private _myEquipment$: Observable<{ success: boolean; data: OsirisMyEquipment }> | null = null;

  /** Mon stock (technicien authentifié) — une seule requête partagée par cycle de navigation. */
  myEquipment(): Observable<{ success: boolean; data: OsirisMyEquipment }> {
    if (!this._myEquipment$) {
      this._myEquipment$ = this.http
        .get<{ success: boolean; data: OsirisMyEquipment }>(`${this.base}/summary/me`)
        .pipe(
          finalize(() => { this._myEquipment$ = null; }),
          shareReplay({ bufferSize: 1, refCount: false })
        );
    }
    return this._myEquipment$;
  }

  /** Liste paginée (admin). */
  list(params?: { q?: string; technicianId?: string; page?: number; limit?: number }): Observable<{ success: boolean; data: OsirisEquipmentList }> {
    let p = new HttpParams();
    if (params?.q) p = p.set('q', params.q);
    if (params?.technicianId) p = p.set('technicianId', params.technicianId);
    if (params?.page) p = p.set('page', String(params.page));
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<{ success: boolean; data: OsirisEquipmentList }>(this.base, { params: p });
  }
}
