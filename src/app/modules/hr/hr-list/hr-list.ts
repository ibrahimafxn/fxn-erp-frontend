import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DepotService } from '../../../core/services/depot.service';
import { HrService } from '../../../core/services/hr.service';
import { environment } from '../../../environments/environment';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import {
  Depot,
  DocAlertsSummary,
  EmployeeDoc,
  EmployeeListResult,
  EmployeeProfile,
  EmployeeSummary,
  HrHistoryItem,
  HrHistoryResult,
  HrRequirements,
  LeaveRequest
} from '../../../core/models';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

@Component({
  selector: 'app-hr-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal],
  providers: [DatePipe],
  templateUrl: './hr-list.html',
  styleUrl: './hr-list.scss',
})
export class HrList {
  private fb = inject(FormBuilder);
  private hr = inject(HrService);
  private auth = inject(AuthService);
  private depotService = inject(DepotService);
  private datePipe = inject(DatePipe);

  readonly tab = signal<'employees' | 'leaves'>('employees');
  readonly employeeSection = signal<'employees' | 'profile' | 'documents'>('employees');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly employees = signal<EmployeeSummary[]>([]);
  readonly employeeAll = signal<EmployeeSummary[]>([]);
  readonly selected = signal<EmployeeSummary | null>(null);
  readonly employeeTotal = signal(0);
  readonly employeePage = signal(1);
  readonly employeeLimit = signal(10);
  readonly pageRange = formatPageRange;
  readonly employeeQuery = signal('');
  readonly employeeRole = signal('');
  readonly employeeDepot = signal('');
  readonly employeeCompliance = signal('');
  readonly docs = signal<EmployeeDoc[]>([]);
  readonly docFilter = signal<'ALL' | 'EXPIRED' | 'EXPIRING'>('ALL');
  readonly expiringDays = 30;
  readonly overlayOpen = signal(false);
  readonly overlayFilter = signal<'EXPIRED' | 'EXPIRING'>('EXPIRED');
  readonly overlayDocs = signal<EmployeeDoc[]>([]);
  readonly overlayLoading = signal(false);
  readonly deleteDocModalOpen = signal(false);
  readonly deletingDocId = signal<string | null>(null);
  readonly pendingDocId = signal<string | null>(null);
  readonly pendingDocLabel = signal<string>('document');
  readonly pendingDocName = signal<string>('');
  readonly leaves = signal<LeaveRequest[]>([]);
  readonly leaveStatus = signal<string>('PENDING');
  readonly depots = signal<Depot[]>([]);
  readonly requirements = signal<HrRequirements | null>(null);
  readonly docAlerts = signal<DocAlertsSummary | null>(null);
  readonly history = signal<HrHistoryItem[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(1);
  readonly historyLimit = signal(10);

  readonly docTypes = [
    { value: 'CNI', label: 'CNI' },
    { value: 'PERMIS', label: 'Permis' },
    { value: 'CONTRAT', label: 'Contrat' },
    { value: 'CARTE_VITALE', label: 'Carte vitale' },
    { value: 'ATTESTATION', label: 'Attestation' },
    { value: 'HABILITATION', label: 'Habilitation' }
  ];
  readonly leaveTypes = ['CONGE', 'MALADIE', 'PERMISSION', 'AUTRE'];
  readonly contractTypes = ['CDI', 'CDD', 'STAGE', 'FREELANCE', 'ASSOCIE', 'AUTRE'];
  readonly employeeRoles = [
    { value: '', label: 'Tous les rôles' },
    { value: 'ADMIN', label: 'ADMIN' },
    { value: 'DIRIGEANT', label: 'DIRIGEANT' },
    { value: 'GESTION_DEPOT', label: 'GESTION_DEPOT' },
    { value: 'TECHNICIEN', label: 'TECHNICIEN' }
  ];
  readonly complianceFilters = [
    { value: '', label: 'Tous les statuts' },
    { value: 'OK', label: 'Conforme' },
    { value: 'MISSING', label: 'Manquant' }
  ];

  readonly canApprove = computed(() => {
    const role = this.auth.user$()?.role;
    return role === 'ADMIN' || role === 'DIRIGEANT';
  });

  readonly employeePageCount = computed(() => {
    const total = this.employeeTotal();
    const limit = this.employeeLimit() || 1;
    return Math.max(1, Math.ceil(total / limit));
  });

  readonly filteredDocs = computed(() => {
    const filter = this.docFilter();
    const docs = this.docs();
    if (filter === 'ALL') return docs;
    if (filter === 'EXPIRED') {
      return docs.filter((d) => this.isDocExpired(d));
    }
    return docs.filter((d) => this.isDocExpiringSoon(d, this.expiringDays));
  });

  readonly overlayItems = computed(() => {
    const docs = this.overlayDocs();
    if (this.overlayFilter() === 'EXPIRED') {
      return docs.filter((d) => this.isDocExpired(d));
    }
    return docs.filter((d) => this.isDocExpiringSoon(d, this.expiringDays));
  });

  readonly historyPageCount = computed(() => {
    const total = this.historyTotal();
    const limit = this.historyLimit() || 1;
    return Math.max(1, Math.ceil(total / limit));
  });

  readonly profileForm = this.fb.nonNullable.group({
    jobTitle: this.fb.nonNullable.control(''),
    contractType: this.fb.nonNullable.control('AUTRE'),
    startDate: this.fb.nonNullable.control(''),
    endDate: this.fb.nonNullable.control(''),
    address: this.fb.nonNullable.control(''),
    emergencyName: this.fb.nonNullable.control(''),
    emergencyPhone: this.fb.nonNullable.control(''),
    notes: this.fb.nonNullable.control('')
  });

  readonly docForm = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control('CNI'),
    detail: this.fb.nonNullable.control(''),
    expiryDate: this.fb.nonNullable.control('')
  });
  readonly docFiles = signal<File[]>([]);
  readonly habilitationOptions = [
    { value: 'ELECTRIQUE', label: 'Électrique' },
    { value: 'TRAVAIL_HAUTEUR', label: 'Travail en hauteur' }
  ];

  constructor() {
    this.depotService.refreshDepots(true, { page: 1, limit: 200 }).subscribe({
      next: (result) => {
        this.depots.set(result?.items || []);
      },
      error: (err: any) => {
        this.error.set(err?.message || 'Erreur chargement dépôts');
      }
    });
    this.hr.getRequirements().subscribe({
      next: (reqs) => this.requirements.set(reqs),
      error: (err: any) => this.error.set(err?.message || 'Erreur chargement exigences')
    });
    this.refreshDocAlerts();
    this.docForm.controls.type.valueChanges.subscribe((type) => {
      if (type === 'HABILITATION') {
        this.docForm.controls.detail.setValidators([Validators.required]);
        if (!this.docForm.controls.detail.value) {
          this.docForm.controls.detail.setValue('ELECTRIQUE');
        }
      } else {
        this.docForm.controls.detail.clearValidators();
      }
      this.docForm.controls.detail.updateValueAndValidity({ emitEvent: false });
    });
    this.loadEmployees();
    this.loadLeaves();
  }

  switchTab(next: 'employees' | 'leaves'): void {
    this.tab.set(next);
  }

  setEmployeeSection(section: 'employees' | 'profile' | 'documents'): void {
    this.employeeSection.set(section);
  }

  loadEmployees(): void {
    this.loading.set(true);
    this.error.set(null);
    const complianceFilter = this.employeeCompliance();
    const useComplianceFilter = Boolean(complianceFilter);
    const bulkLimit = 1000;
    this.hr.listEmployees({
      q: this.employeeQuery(),
      role: this.employeeRole(),
      depot: this.employeeDepot(),
      page: useComplianceFilter ? 1 : this.employeePage(),
      limit: useComplianceFilter ? bulkLimit : this.employeeLimit()
    }).subscribe({
      next: (result: EmployeeListResult) => {
        let items = result?.items || [];
        if (useComplianceFilter) {
          items = items.filter((item) => this.complianceStatus(item) === complianceFilter);
        }
        if (useComplianceFilter) {
          this.employeeAll.set(items);
          this.applyEmployeePagination(items);
        } else {
          this.employeeAll.set([]);
          this.setEmployeeList(items, result?.total || 0);
        }
        this.loading.set(false);
      },
      error: (err: any) => {
        this.error.set(err?.message || 'Erreur chargement RH');
        this.loading.set(false);
      }
    });
  }

  applyEmployeeFilters(): void {
    this.employeePage.set(1);
    this.loadEmployees();
  }

  setEmployeeLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.employeeLimit.set(value);
    this.employeePage.set(1);
    this.loadEmployees();
  }

  resetEmployeeFilters(): void {
    this.employeeQuery.set('');
    this.employeeRole.set('');
    this.employeeDepot.set('');
    this.employeeCompliance.set('');
    this.employeePage.set(1);
    this.loadEmployees();
  }

  prevEmployeePage(): void {
    const next = Math.max(1, this.employeePage() - 1);
    this.employeePage.set(next);
    if (this.employeeCompliance()) {
      const items = this.employeeAll();
      if (items.length) {
        this.applyEmployeePagination(items);
        return;
      }
    }
    this.loadEmployees();
  }

  nextEmployeePage(): void {
    const totalPages = Math.max(1, Math.ceil(this.employeeTotal() / this.employeeLimit()));
    const next = Math.min(totalPages, this.employeePage() + 1);
    this.employeePage.set(next);
    if (this.employeeCompliance()) {
      const items = this.employeeAll();
      if (items.length) {
        this.applyEmployeePagination(items);
        return;
      }
    }
    this.loadEmployees();
  }

  selectEmployee(item: EmployeeSummary): void {
    this.selected.set(item);
    this.employeeSection.set('profile');
    this.overlayOpen.set(false);
    this.patchProfile(item.profile || null);
    this.scrollToProfile();
    const userId = item.user?._id || '';
    if (!userId) return;
    this.hr.listDocs({ user: userId }).subscribe((docs: EmployeeDoc[]) => this.docs.set(docs || []));
    this.refreshCompliance(userId);
    this.loadHistory(userId);
  }

  private applyEmployeePagination(items: EmployeeSummary[]): void {
    const limit = this.employeeLimit() || 1;
    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / limit));
    if (this.employeePage() > pageCount) {
      this.employeePage.set(pageCount);
    }
    const page = this.employeePage();
    const start = (page - 1) * limit;
    this.setEmployeeList(items.slice(start, start + limit), total);
  }

  private setEmployeeList(items: EmployeeSummary[], total: number): void {
    this.employeeTotal.set(total);
    this.employees.set(items);
    if (items.length) {
      const hasSelected = this.selected() && items.some((e) => e.user._id === this.selected()?.user._id);
      if (this.employeeSection() !== 'employees' && !hasSelected) {
        this.selectEmployee(items[0]);
        return;
      }
      if (!hasSelected) {
        this.selected.set(null);
        this.docs.set([]);
      }
    } else {
      this.selected.set(null);
      this.docs.set([]);
    }
  }

  patchProfile(profile: EmployeeProfile | null): void {
    this.profileForm.reset({
      jobTitle: profile?.jobTitle || '',
      contractType: profile?.contractType || 'AUTRE',
      startDate: profile?.startDate ? String(profile.startDate).slice(0, 10) : '',
      endDate: profile?.endDate ? String(profile.endDate).slice(0, 10) : '',
      address: profile?.address || '',
      emergencyName: profile?.emergencyName || '',
      emergencyPhone: profile?.emergencyPhone || '',
      notes: profile?.notes || ''
    });
  }

  saveProfile(): void {
    const current = this.selected();
    if (!current?.user?._id) return;
    const raw = this.profileForm.getRawValue();
    const payload: Partial<EmployeeProfile> = {
      ...raw,
      contractType: raw.contractType as EmployeeProfile['contractType']
    };
    this.hr.upsertProfile(current.user._id, payload).subscribe({
      next: (profile: EmployeeProfile) => {
        const updated = this.employees().map((e) =>
          e.user._id === current.user._id ? { ...e, profile } : e
        );
        this.employees.set(updated);
        this.selectEmployee({ ...current, profile });
      },
      error: (err: any) => {
        this.error.set(err?.message || 'Erreur sauvegarde profil');
      }
    });
  }

  onDocFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input?.files ? Array.from(input.files) : [];
    this.docFiles.set(files);
  }

  addDoc(fileInput?: HTMLInputElement): void {
    const current = this.selected();
    if (!current?.user?._id) return;
    const payload = this.docForm.getRawValue();
    const files = this.docFiles();
    if (!files.length) return;
    if (payload.type === 'HABILITATION' && !payload.detail) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append('user', current.user._id);
      formData.append('type', payload.type);
      formData.append('detail', payload.detail || '');
      if (payload.expiryDate) {
        formData.append('expiryDate', payload.expiryDate);
      }
      formData.append('file', file);

      this.hr.addDocument(formData).subscribe({
        next: (doc: EmployeeDoc) => {
          this.docs.set([doc, ...this.docs()]);
          this.refreshCompliance(current.user._id);
          this.loadEmployees();
          this.loadHistory(current.user._id);
          this.refreshDocAlerts();
        },
        error: (err: any) => {
          this.error.set(err?.message || 'Erreur ajout document');
        }
      });
    }
    this.docForm.patchValue({ detail: '', expiryDate: '' });
    this.docFiles.set([]);
    if (fileInput) fileInput.value = '';
  }

  refreshCompliance(userId: string): void {
    this.hr.getCompliance(userId).subscribe({
      next: (compliance) => {
        this.employees.set(this.employees().map((e) =>
          e.user._id === userId ? { ...e, compliance } : e
        ));
        const current = this.selected();
        if (current?.user?._id === userId) {
          this.selected.set({ ...current, compliance });
        }
        if (this.employeeCompliance()) {
          this.loadEmployees();
        }
      }
    });
  }

  removeDoc(doc: EmployeeDoc): void {
    this.deletingDocId.set(doc._id);
    this.hr.deleteDoc(doc._id).subscribe({
      next: () => {
        this.deletingDocId.set(null);
        this.docs.set(this.docs().filter((d) => d._id !== doc._id));
        const current = this.selected();
        if (current?.user?._id) {
          this.refreshCompliance(current.user._id);
          this.loadEmployees();
          this.loadHistory(current.user._id);
          this.refreshDocAlerts();
        }
      },
      error: (err: any) => {
        this.deletingDocId.set(null);
        this.error.set(err?.message || 'Erreur suppression document');
      }
    });
  }

  openDeleteDocModal(doc: EmployeeDoc): void {
    this.pendingDocId.set(doc._id);
    const label = doc.detail || doc.type || 'Document';
    this.pendingDocName.set(label);
    this.pendingDocLabel.set('document');
    this.deleteDocModalOpen.set(true);
  }

  closeDeleteDocModal(): void {
    if (this.confirmingDeleteDoc()) return;
    this.deleteDocModalOpen.set(false);
    this.pendingDocId.set(null);
    this.pendingDocName.set('');
  }

  confirmDeleteDoc(): void {
    const id = this.pendingDocId();
    if (!id) return;
    const doc = this.docs().find((d) => d._id === id);
    if (!doc) return;
    this.deleteDocModalOpen.set(false);
    this.removeDoc(doc);
  }

  confirmingDeleteDoc(): boolean {
    const id = this.pendingDocId();
    return !!id && this.deletingDocId() === id;
  }

  setDocFilter(filter: 'ALL' | 'EXPIRED' | 'EXPIRING'): void {
    this.employeeSection.set('documents');
    this.docFilter.set(filter);
    const el = document.getElementById('hr-documents');
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  openDocOverlay(filter: 'EXPIRED' | 'EXPIRING'): void {
    this.employeeSection.set('documents');
    this.overlayFilter.set(filter);
    this.overlayOpen.set(true);
    this.overlayLoading.set(true);
    this.hr.listDocs().subscribe({
      next: (docs) => {
        this.overlayDocs.set(docs || []);
        this.overlayLoading.set(false);
        setTimeout(() => {
          const el = document.getElementById('doc-alerts-panel');
          if (el) {
            const offset = 80;
            const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }, 0);
      },
      error: (err: any) => {
        this.error.set(err?.message || 'Erreur chargement documents');
        this.overlayLoading.set(false);
      }
    });
  }

  closeDocOverlay(): void {
    this.overlayOpen.set(false);
  }

  overlayTitle(): string {
    return this.overlayFilter() === 'EXPIRED' ? 'Documents expirés' : 'Documents expirent bientôt';
  }

  loadHistory(userId: string): void {
    this.hr.listHistory({ user: userId, page: this.historyPage(), limit: this.historyLimit() })
      .subscribe({
        next: (result: HrHistoryResult) => {
          this.history.set(result?.items || []);
          this.historyTotal.set(result?.total || 0);
        },
        error: (err: any) => this.error.set(err?.message || 'Erreur chargement historique')
      });
  }

  refreshDocAlerts(): void {
    this.hr.listDocAlerts(30).subscribe({
      next: (alerts) => this.docAlerts.set(alerts),
      error: (err: any) => this.error.set(err?.message || 'Erreur chargement alertes docs')
    });
  }

  prevHistoryPage(): void {
    const next = Math.max(1, this.historyPage() - 1);
    this.historyPage.set(next);
    const userId = this.selected()?.user?._id;
    if (userId) this.loadHistory(userId);
  }

  nextHistoryPage(): void {
    const totalPages = Math.max(1, Math.ceil(this.historyTotal() / this.historyLimit()));
    const next = Math.min(totalPages, this.historyPage() + 1);
    this.historyPage.set(next);
    const userId = this.selected()?.user?._id;
    if (userId) this.loadHistory(userId);
  }

  setHistoryLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.historyLimit.set(value);
    this.historyPage.set(1);
    const userId = this.selected()?.user?._id;
    if (userId) this.loadHistory(userId);
  }

  loadLeaves(): void {
    const status = this.leaveStatus();
    this.hr.listLeaves(status ? { status } : undefined).subscribe({
      next: (items: LeaveRequest[]) => this.leaves.set(items || []),
      error: (err: any) => this.error.set(err?.message || 'Erreur chargement congés')
    });
  }

  decideLeave(leave: LeaveRequest, decision: 'APPROVED' | 'REJECTED'): void {
    this.hr.decideLeave(leave._id, decision).subscribe({
      next: (updated: LeaveRequest) => {
        this.leaves.set(this.leaves().map((l) => (l._id === updated._id ? updated : l)));
      },
      error: (err: any) => this.error.set(err?.message || 'Erreur décision congé')
    });
  }

  formatUserName(user?: any): string {
    if (!user) return '—';
    return formatPersonName(user.firstName || '', user.lastName || '') || user.email || '—';
  }

  depotLabel(user?: any): string {
    const depot = user?.idDepot;
    if (!depot) return '—';
    if (typeof depot === 'object' && depot?.name) {
      return formatDepotName(depot.name) || depot.name;
    }
    const depotId = typeof depot === 'string' ? depot : depot?._id || depot?.idDepot;
    const match = this.depots().find((d) => String(d?._id || d?.idDep) === String(depotId));
    if (match?.name) return formatDepotName(match.name) || match.name;
    return depotId ? String(depotId) : '—';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    return this.datePipe.transform(value, 'dd/MM/yyyy') || '—';
  }

  complianceLabel(item: EmployeeSummary): string {
    const compliance = item.compliance;
    if (!compliance) return '—';
    return compliance.ok ? 'OK' : `Manquant: ${compliance.missing.join(', ')}`;
  }

  complianceStatus(item: EmployeeSummary): string {
    const compliance = item.compliance;
    if (!compliance) return '';
    return compliance.ok ? 'OK' : 'MISSING';
  }

  isDocExpired(doc: EmployeeDoc): boolean {
    if (doc.valid === false) return true;
    if (!doc.expiryDate) return false;
    return new Date(doc.expiryDate).getTime() < Date.now();
  }

  isDocExpiringSoon(doc: EmployeeDoc, days = 30): boolean {
    if (doc.valid === false) return false;
    if (!doc.expiryDate) return false;
    const now = Date.now();
    const target = new Date(doc.expiryDate).getTime();
    if (target < now) return false;
    const threshold = now + days * 24 * 60 * 60 * 1000;
    return target <= threshold;
  }

  isDocValid(doc: EmployeeDoc): boolean {
    if (doc.valid === false) return false;
    return !this.isDocExpired(doc);
  }

  isImageDoc(doc: EmployeeDoc): boolean {
    const url = doc?.fileUrl || '';
    return /\.(png|jpe?g)$/i.test(url);
  }

  isHabilitationSelected(): boolean {
    return this.docForm.controls.type.value === 'HABILITATION';
  }

  requiredDocsForUser(user?: any): string[] {
    const reqs = this.requirements();
    if (!reqs) return [];
    const role = user?.role || 'DEFAULT';
    return reqs.typesByRole[role] || reqs.typesByRole['DEFAULT'] || [];
  }

  docTypeLabel(type: string): string {
    const reqs = this.requirements();
    return reqs?.typeLabels?.[type] || type;
  }

  docPdfUrl(doc: EmployeeDoc): string {
    return `${environment.apiBaseUrl}/hr/docs/${doc._id}/pdf`;
  }

  openDoc(doc: EmployeeDoc): void {
    this.hr.downloadDoc(doc._id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.error.set('Téléchargement document impossible.');
      }
    });
  }

  isRequiredDocSatisfied(type: string): boolean {
    return this.docs().some((d) => d.type === type && this.isDocValid(d));
  }

  historyActionLabel(action: HrHistoryItem['action']): string {
    if (action === 'PROFILE_UPDATE') return 'Profil';
    if (action === 'DOC_ADD') return 'Ajout document';
    if (action === 'DOC_DELETE') return 'Suppression document';
    return action;
  }

  historyDetail(item: HrHistoryItem): string {
    const meta = item.meta || {};
    if (item.action === 'PROFILE_UPDATE') return 'Mise à jour profil';
    if (item.action === 'DOC_ADD') return `${this.docTypeLabel(meta.type || '')}`.trim();
    if (item.action === 'DOC_DELETE') return `${this.docTypeLabel(meta.type || '')}`.trim();
    return '—';
  }

  private scrollToProfile(): void {
    setTimeout(() => {
      const el = document.getElementById('hr-employee-profile');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
