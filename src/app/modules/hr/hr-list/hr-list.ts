import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { DepotService } from '../../../core/services/depot.service';
import { AbsenceService } from '../../../core/services/absence.service';
import { HrService } from '../../../core/services/hr.service';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';
import { ConfirmActionModal } from '../../../shared/components/dialog/confirm-action-modal/confirm-action-modal';
import {
  Absence,
  AbsenceStatus,
  Depot,
  DocAlertsSummary,
  EmployeeDoc,
  EmployeeListResult,
  EmployeeProfile,
  EmployeeSummary,
  Payslip,
  HrHistoryItem,
  HrHistoryResult,
  HrRequirements,
  User
} from '../../../core/models';
import { formatDepotName, formatPersonName } from '../../../core/utils/text-format';
import { downloadBlob } from '../../../core/utils/download';
import { Role } from '../../../core/models/roles.model';
import { resolveUserAvatarUrl } from '../../../core/utils/avatar-url';
import { formatPageRange } from '../../../core/utils/pagination';
import {
  ABSENCE_STATUS_LABELS,
  ABSENCE_TYPE_LABELS,
  HR_ALLOWED_ABSENCE_STATUSES,
  HR_COMPLIANCE_FILTERS,
  HR_CONTRACT_TYPES,
  HR_DOC_TYPES,
  HR_EMPLOYEE_ROLES,
  HR_HABILITATION_OPTIONS,
  HR_LEAVE_TYPES,
  NORMALIZED_CONTRACT_LABELS
} from './hr-list.constants';

@Component({
  selector: 'app-hr-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ConfirmDeleteModal, ConfirmActionModal],
  providers: [DatePipe],
  templateUrl: './hr-list.html',
  styleUrl: './hr-list.scss',
})
export class HrList {
  private fb = inject(FormBuilder);
  private hr = inject(HrService);
  private absences = inject(AbsenceService);
  private auth = inject(AuthService);
  private depotService = inject(DepotService);
  private datePipe = inject(DatePipe);

  readonly tab = signal<'employees' | 'leaves'>('employees');
  readonly employeeSection = signal<'employees' | 'profile' | 'documents'>('employees');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  private successTimer: number | null = null;

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
  readonly employeeSort = signal<'NAME_ASC' | 'NAME_DESC' | 'ROLE_ASC' | 'DEPOT_ASC' | 'DOCS_ASC'>('NAME_ASC');
  readonly docs = signal<EmployeeDoc[]>([]);
  readonly docFilter = signal<'ALL' | 'EXPIRED' | 'EXPIRING'>('ALL');
  readonly expiringDays = 30;
  readonly docPage = signal(1);
  readonly docLimit = signal(10);
  readonly overlayOpen = signal(false);
  readonly overlayFilter = signal<'EXPIRED' | 'EXPIRING'>('EXPIRED');
  readonly overlayDocs = signal<EmployeeDoc[]>([]);
  readonly overlayLoading = signal(false);
  readonly deleteDocModalOpen = signal(false);
  readonly deletingDocId = signal<string | null>(null);
  readonly pendingDocId = signal<string | null>(null);
  readonly pendingDoc = signal<EmployeeDoc | null>(null);
  readonly pendingDocLabel = signal<string>('document');
  readonly pendingDocName = signal<string>('');
  readonly leaves = signal<Absence[]>([]);
  readonly leaveStatus = signal<AbsenceStatus>('EN_ATTENTE');
  readonly leavePage = signal(1);
  readonly leaveLimit = signal(10);
  readonly leaveSort = signal<'EMP_ASC' | 'DEPOT_ASC' | 'TYPE_ASC' | 'PERIOD_ASC' | 'STATUS_ASC'>('PERIOD_ASC');
  readonly depots = signal<Depot[]>([]);
  readonly requirements = signal<HrRequirements | null>(null);
  readonly docAlerts = signal<DocAlertsSummary | null>(null);
  readonly history = signal<HrHistoryItem[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(1);
  readonly historyLimit = signal(10);
  readonly historySort = signal<'DATE_DESC' | 'DATE_ASC' | 'ACTION_ASC' | 'AUTHOR_ASC' | 'DETAIL_ASC'>('DATE_DESC');

  avatarSrc(user: User): string {
    const cacheKey = (user as { updatedAt?: string; lastLoginAt?: string }).updatedAt
      || (user as { updatedAt?: string; lastLoginAt?: string }).lastLoginAt
      || '';
    return resolveUserAvatarUrl(user, cacheKey);
  }

  userInitials(user: User): string {
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    const value = `${first}${last}`.toUpperCase();
    return value || (user.email?.[0] ?? '').toUpperCase();
  }

  readonly docTypes = HR_DOC_TYPES;
  readonly leaveTypes = HR_LEAVE_TYPES;
  readonly contractTypes = HR_CONTRACT_TYPES;
  readonly employeeRoles = HR_EMPLOYEE_ROLES;
  readonly complianceFilters = HR_COMPLIANCE_FILTERS;

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

  readonly docTotal = computed(() => this.filteredDocs().length);

  readonly docPageCount = computed(() => {
    const total = this.docTotal();
    const limit = this.docLimit() || 1;
    return Math.max(1, Math.ceil(total / limit));
  });

  readonly visibleDocs = computed(() => {
    const items = this.filteredDocs();
    const limit = this.docLimit() || 1;
    const page = this.docPage();
    const start = (page - 1) * limit;
    return items.slice(start, start + limit);
  });

  readonly overlayItems = computed(() => {
    const docs = this.overlayDocs();
    if (this.overlayFilter() === 'EXPIRED') {
      return docs.filter((d) => this.isDocExpired(d));
    }
    return docs.filter((d) => this.isDocExpiringSoon(d, this.expiringDays));
  });

  setDocLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.docLimit.set(value);
    this.docPage.set(1);
  }

  prevDocPage(): void {
    const next = Math.max(1, this.docPage() - 1);
    this.docPage.set(next);
  }

  nextDocPage(): void {
    const totalPages = this.docPageCount();
    const next = Math.min(totalPages, this.docPage() + 1);
    this.docPage.set(next);
  }

  readonly historyPageCount = computed(() => {
    const total = this.historyTotal();
    const limit = this.historyLimit() || 1;
    return Math.max(1, Math.ceil(total / limit));
  });

  readonly leaveTotal = computed(() => this.leaves().length);

  readonly leavePageCount = computed(() => {
    const total = this.leaveTotal();
    const limit = this.leaveLimit() || 1;
    return Math.max(1, Math.ceil(total / limit));
  });

  readonly sortedLeaves = computed(() => {
    const items = [...this.leaves()];
    const sort = this.leaveSort();
    const byText = (value: string) => value.toLowerCase();
    const compareText = (a: string, b: string) => byText(a).localeCompare(byText(b));
    const getUser = (l: Absence) => this.formatUserName(this.absenceTechnician(l));
    const getDepot = (l: Absence) => this.depotLabel(this.absenceTechnician(l));
    const getType = (l: Absence) => String(l.type || '');
    const getStatus = (l: Absence) => String(l.status || '');
    const getPeriod = (l: Absence) => `${l.startDate || ''}|${l.endDate || ''}`;
    items.sort((a, b) => {
      switch (sort) {
        case 'EMP_ASC':
          return compareText(getUser(a), getUser(b));
        case 'DEPOT_ASC':
          return compareText(getDepot(a), getDepot(b));
        case 'TYPE_ASC':
          return compareText(getType(a), getType(b));
        case 'STATUS_ASC':
          return compareText(getStatus(a), getStatus(b));
        case 'PERIOD_ASC':
        default:
          return compareText(getPeriod(a), getPeriod(b));
      }
    });
    return items;
  });

  readonly visibleLeaves = computed(() => {
    const items = this.sortedLeaves();
    const limit = this.leaveLimit() || 1;
    const page = this.leavePage();
    const start = (page - 1) * limit;
    return items.slice(start, start + limit);
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
  readonly payslipForm = this.fb.nonNullable.group({
    month: this.fb.nonNullable.control(new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]),
    year: this.fb.nonNullable.control(new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]),
    hoursWorked: this.fb.nonNullable.control(0, [Validators.min(0)]),
    hourlyRate: this.fb.nonNullable.control(0, [Validators.min(0)]),
    overtimeHours: this.fb.nonNullable.control(0, [Validators.min(0)]),
    baseSalary: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    fraisKm: this.fb.nonNullable.control(0, [Validators.min(0)]),
    deductions: this.fb.nonNullable.control(0, [Validators.min(0)]),
    employeeContrib: this.fb.nonNullable.control(0, [Validators.min(0)]),
    employerContrib: this.fb.nonNullable.control(0, [Validators.min(0)]),
    panierRepas: this.fb.nonNullable.control(0, [Validators.min(0)])
  });
  readonly payslipLoading = signal(false);
  readonly payslipConfirmOpen = signal(false);
  readonly exportConfirmOpen = signal(false);
  readonly profileConfirmOpen = signal(false);
  readonly payslipExportLoading = signal(false);
  readonly payslipError = signal<string | null>(null);
  readonly payslipList = signal<Payslip[]>([]);
  readonly payslipListLoading = signal(false);
  readonly payslipListError = signal<string | null>(null);
  readonly payslipTotal = signal(0);
  readonly payslipPage = signal(1);
  readonly payslipLimit = signal(5);
  readonly payslipMonth = signal<number | ''>('');
  readonly payslipYear = signal<number | ''>('');
  readonly payslipPageCount = computed(() => {
    const limit = this.payslipLimit() || 1;
    return Math.max(1, Math.ceil(this.payslipTotal() / limit));
  });
  readonly payslipMonthOptions = Array.from({ length: 12 }, (_, idx) => idx + 1);
  readonly payslipYearOptions = Array.from({ length: 11 }, (_, idx) => 2026 + idx);
  readonly canGeneratePayslip = computed(() => {
    const role = this.auth.user$()?.role;
    return role === Role.ADMIN || role === Role.DIRIGEANT;
  });
  readonly selectedContractLabel = computed(() => this.contractLabel(this.profileForm.controls.contractType.value));
  readonly selectedSegmentSourceLabel = computed(() => this.segmentSourceLabel(this.profileForm.controls.contractType.value));
  readonly requiredDocCount = computed(() => this.requiredDocsForUser(this.selected()?.user).length);
  readonly satisfiedRequiredDocCount = computed(() =>
    this.requiredDocsForUser(this.selected()?.user).filter((type) => this.isRequiredDocSatisfied(type)).length
  );

  readonly docForm = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control('CNI'),
    detail: this.fb.nonNullable.control(''),
    expiryDate: this.fb.nonNullable.control('')
  });
  readonly docFiles = signal<File[]>([]);
  readonly habilitationOptions = HR_HABILITATION_OPTIONS;

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

  onLeaveStatusChange(value: string): void {
    const normalized = value as AbsenceStatus;
    this.leaveStatus.set(HR_ALLOWED_ABSENCE_STATUSES.includes(normalized) ? normalized : 'EN_ATTENTE');
    this.loadLeaves();
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
        items = this.sortEmployees(items);
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

  setEmployeeSort(value: string): void {
    if (!value) return;
    this.employeeSort.set(value as any);
    this.applyEmployeeFilters();
  }

  toggleEmployeeSort(field: 'NAME' | 'ROLE' | 'DEPOT' | 'DOCS'): void {
    const current = this.employeeSort();
    let next = current;
    if (field === 'NAME') {
      next = current === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC';
    } else if (field === 'ROLE') {
      next = 'ROLE_ASC';
    } else if (field === 'DEPOT') {
      next = 'DEPOT_ASC';
    } else if (field === 'DOCS') {
      next = 'DOCS_ASC';
    }
    if (next === current) return;
    this.employeeSort.set(next);
    this.applyEmployeeFilters();
  }

  isEmployeeSort(field: 'NAME' | 'ROLE' | 'DEPOT' | 'DOCS'): boolean {
    const current = this.employeeSort();
    if (field === 'NAME') return current === 'NAME_ASC' || current === 'NAME_DESC';
    if (field === 'ROLE') return current === 'ROLE_ASC';
    if (field === 'DEPOT') return current === 'DEPOT_ASC';
    return current === 'DOCS_ASC';
  }

  employeeSortArrow(field: 'NAME' | 'ROLE' | 'DEPOT' | 'DOCS'): string {
    const current = this.employeeSort();
    if (field === 'NAME') return current === 'NAME_DESC' ? '▼' : '▲';
    if (!this.isEmployeeSort(field)) return '';
    return '▲';
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
    this.employeeSort.set('NAME_ASC');
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
    this.payslipError.set(null);
    this.payslipListError.set(null);
    this.patchProfile(item.profile || null);
    this.scrollToProfile();
    const userId = item.user?._id || '';
    if (!userId) return;
    this.hr.listDocs({ user: userId }).subscribe((docs: EmployeeDoc[]) => this.docs.set(docs || []));
    this.refreshCompliance(userId);
    this.loadHistory(userId);
    this.loadPayslips(userId);
  }

  openPayslipFor(item: EmployeeSummary): void {
    this.selectEmployee(item);
    this.setEmployeeSection('profile');
    this.scrollToPayslip();
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
        this.payslipList.set([]);
        this.payslipTotal.set(0);
        this.payslipPage.set(1);
      }
    } else {
      this.selected.set(null);
      this.docs.set([]);
      this.payslipList.set([]);
      this.payslipTotal.set(0);
      this.payslipPage.set(1);
    }
  }

  private sortEmployees(items: EmployeeSummary[]): EmployeeSummary[] {
    const sort = this.employeeSort();
    if (!sort) return items;
    const sorted = [...items];
    const nameOf = (e: EmployeeSummary) => this.normalizeSort(this.formatUserName(e.user));
    const roleOf = (e: EmployeeSummary) => this.normalizeSort(e.user?.role || '');
    const depotOf = (e: EmployeeSummary) => this.normalizeSort(this.depotLabel(e.user));
    const docsOf = (e: EmployeeSummary) => {
      const compliance = e.compliance;
      if (!compliance) return 0;
      if (compliance.ok) return 0;
      return Array.isArray(compliance.missing) ? compliance.missing.length : 1;
    };
    sorted.sort((a, b) => {
      switch (sort) {
        case 'NAME_DESC':
          return nameOf(b).localeCompare(nameOf(a), 'fr');
        case 'ROLE_ASC':
          return roleOf(a).localeCompare(roleOf(b), 'fr');
        case 'DEPOT_ASC':
          return depotOf(a).localeCompare(depotOf(b), 'fr');
        case 'DOCS_ASC':
          return docsOf(b) - docsOf(a);
        case 'NAME_ASC':
        default:
          return nameOf(a).localeCompare(nameOf(b), 'fr');
      }
    });
    return sorted;
  }

  private normalizeSort(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  patchProfile(profile: EmployeeProfile | null): void {
    this.profileForm.reset({
      jobTitle: profile?.jobTitle || '',
      contractType: this.normalizeContractType(profile?.contractType),
      startDate: profile?.startDate ? String(profile.startDate).slice(0, 10) : '',
      endDate: profile?.endDate ? String(profile.endDate).slice(0, 10) : '',
      address: profile?.address || '',
      emergencyName: profile?.emergencyName || '',
      emergencyPhone: profile?.emergencyPhone || '',
      notes: profile?.notes || ''
    });
  }

  openProfileConfirm(): void {
    this.profileConfirmOpen.set(true);
  }

  closeProfileConfirm(): void {
    this.profileConfirmOpen.set(false);
  }

  confirmSaveProfile(): void {
    this.profileConfirmOpen.set(false);
    this.saveProfile();
  }

  private saveProfile(): void {
    const current = this.selected();
    if (!current?.user?._id) return;
    const raw = this.profileForm.getRawValue();
    const payload: Partial<EmployeeProfile> = {
      ...raw,
      contractType: this.normalizeContractType(raw.contractType) as EmployeeProfile['contractType']
    };
    this.hr.upsertProfile(current.user._id, payload).subscribe({
      next: (profile: EmployeeProfile) => {
        const updated = this.employees().map((e) =>
          e.user._id === current.user._id ? { ...e, profile } : e
        );
        this.employees.set(updated);
        this.selectEmployee({ ...current, profile });
        this.showSuccess('Profil enregistré.');
      },
      error: (err: any) => {
        this.error.set(err?.message || 'Erreur sauvegarde profil');
      }
    });
  }

  private normalizeContractType(contractType: string | null | undefined): 'FREELANCE' | 'SALARIE' | 'AUTRE' | 'PERSONNALISE' {
    const value = String(contractType || '').trim().toUpperCase();
    if (value === 'FREELANCE') return 'FREELANCE';
    if (value === 'PERSONNALISE') return 'PERSONNALISE';
    if (value === 'AUTRE') return 'AUTRE';
    if (value === 'CDI' || value === 'CDD' || value === 'STAGE' || value === 'SALARIE') return 'SALARIE';
    return 'AUTRE';
  }

  contractLabel(value?: string | null): string {
    const type = this.normalizeContractType(value);
    return NORMALIZED_CONTRACT_LABELS[type];
  }

  segmentSourceLabel(value?: string | null): string {
    return this.contractLabel(value);
  }

  openPayslipConfirm(): void {
    if (this.payslipLoading()) return;
    this.payslipConfirmOpen.set(true);
  }

  closePayslipConfirm(): void {
    if (this.payslipLoading()) return;
    this.payslipConfirmOpen.set(false);
  }

  confirmGeneratePayslip(): void {
    this.payslipConfirmOpen.set(false);
    this.generatePayslip();
  }

  generatePayslip(): void {
    const current = this.selected();
    if (!current?.user?._id) return;
    if (this.payslipForm.invalid) {
      this.payslipForm.markAllAsTouched();
      return;
    }
    const raw = this.payslipForm.getRawValue();
    let baseSalary = Number(raw.baseSalary || 0);
    if (!baseSalary && raw.hoursWorked && raw.hourlyRate) {
      baseSalary = Number(raw.hoursWorked) * Number(raw.hourlyRate);
    }
    const payload = {
      month: Number(raw.month),
      year: Number(raw.year),
      hoursWorked: raw.hoursWorked ? Number(raw.hoursWorked) : undefined,
      hourlyRate: raw.hourlyRate ? Number(raw.hourlyRate) : undefined,
      overtimeHours: raw.overtimeHours ? Number(raw.overtimeHours) : undefined,
      baseSalary,
      fraisKm: Number(raw.fraisKm || 0),
      deductions: Number(raw.deductions || 0),
      employeeContrib: Number(raw.employeeContrib || 0),
      employerContrib: Number(raw.employerContrib || 0),
      panierRepas: raw.panierRepas ? Number(raw.panierRepas) : undefined
    };
    this.payslipLoading.set(true);
    this.payslipError.set(null);
    this.hr.generatePayslipPdf(current.user._id, payload).subscribe({
      next: (blob: Blob) => {
        const name = this.formatUserName(current.user).replace(/\s+/g, '_') || 'employe';
        const fileName = `fiche_paie_${name}_${String(payload.month).padStart(2, '0')}-${payload.year}.pdf`;
        downloadBlob(blob, fileName);
        this.payslipLoading.set(false);
        this.loadPayslips(current.user._id);
      },
      error: (err: any) => {
        this.payslipLoading.set(false);
        this.payslipError.set(err?.error?.message || 'Erreur génération fiche de paie');
      }
    });
  }

  loadPayslips(userId: string): void {
    this.payslipListLoading.set(true);
    this.payslipListError.set(null);
    this.hr.listPayslips(userId, {
      page: this.payslipPage(),
      limit: this.payslipLimit(),
      month: this.payslipMonth() || undefined,
      year: this.payslipYear() || undefined
    }).subscribe({
      next: (result) => {
        this.payslipList.set(result?.items || []);
        this.payslipTotal.set(result?.total || 0);
        this.payslipPage.set(result?.page || 1);
        this.payslipListLoading.set(false);
      },
      error: (err: any) => {
        this.payslipListLoading.set(false);
        this.payslipListError.set(err?.error?.message || 'Erreur chargement fiches de paie');
      }
    });
  }

  setPayslipLimit(limit: number): void {
    this.payslipLimit.set(limit);
    this.payslipPage.set(1);
    this.reloadSelectedPayslips();
  }

  setPayslipMonth(value: string): void {
    const parsed = Number(value);
    this.payslipMonth.set(Number.isFinite(parsed) && parsed > 0 ? parsed : '');
    this.payslipPage.set(1);
    this.reloadSelectedPayslips();
  }

  setPayslipYear(value: string): void {
    const parsed = Number(value);
    this.payslipYear.set(Number.isFinite(parsed) && parsed > 0 ? parsed : '');
    this.payslipPage.set(1);
    this.reloadSelectedPayslips();
  }

  prevPayslipPage(): void {
    if (this.payslipPage() <= 1) return;
    this.payslipPage.set(this.payslipPage() - 1);
    this.reloadSelectedPayslips();
  }

  nextPayslipPage(): void {
    const totalPages = Math.max(1, Math.ceil(this.payslipTotal() / this.payslipLimit()));
    if (this.payslipPage() >= totalPages) return;
    this.payslipPage.set(this.payslipPage() + 1);
    this.reloadSelectedPayslips();
  }

  downloadPayslip(slip: Payslip): void {
    const userId = this.selected()?.user?._id;
    if (!userId || !slip?._id) return;
    this.hr.downloadPayslip(userId, slip._id).subscribe({
      next: (blob: Blob) => {
        const name = this.formatUserName(this.selected()?.user as User).replace(/\s+/g, '_') || 'employe';
        const period = this.formatPayslipPeriod(slip).replace(/\s+/g, '_').replace(/[/:]/g, '-');
        const fileName = `fiche_paie_${name}_${period || 'periode'}.pdf`;
        downloadBlob(blob, fileName);
      },
      error: (err: any) => {
        this.payslipListError.set(err?.error?.message || 'Erreur téléchargement fiche de paie');
      }
    });
  }

  openExportConfirm(): void {
    if (this.payslipExportLoading()) return;
    this.exportConfirmOpen.set(true);
  }

  closeExportConfirm(): void {
    if (this.payslipExportLoading()) return;
    this.exportConfirmOpen.set(false);
  }

  confirmExportPayslips(): void {
    this.exportConfirmOpen.set(false);
    this.exportPayslipsXlsx();
  }

  exportPayslipsXlsx(): void {
    const userId = this.selected()?.user?._id;
    if (!userId) return;
    this.payslipExportLoading.set(true);
    this.hr.exportPayslipsXlsx(userId, {
      page: this.payslipPage(),
      limit: this.payslipLimit(),
      month: this.payslipMonth() || undefined,
      year: this.payslipYear() || undefined
    }).subscribe({
      next: (blob: Blob) => {
        const name = this.formatUserName(this.selected()?.user as User).replace(/\s+/g, '_') || 'employe';
        const fileName = `fiches_paie_${name}_${String(this.payslipPage())}-${String(this.payslipLimit())}.xlsx`;
        downloadBlob(blob, fileName);
        this.payslipExportLoading.set(false);
      },
      error: (err: any) => {
        this.payslipExportLoading.set(false);
        this.payslipListError.set(err?.error?.message || 'Erreur export Excel');
      }
    });
  }

  formatPayslipPeriod(slip: Payslip): string {
    if (slip.month && slip.year) {
      return `${String(slip.month).padStart(2, '0')}/${slip.year}`;
    }
    const start = slip.periodStart ? this.datePipe.transform(slip.periodStart, 'dd/MM/yyyy') : '';
    const end = slip.periodEnd ? this.datePipe.transform(slip.periodEnd, 'dd/MM/yyyy') : '';
    const range = `${start || ''}${start || end ? ' - ' : ''}${end || ''}`.trim();
    return range || 'periode';
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
          this.showSuccess('Document ajouté.');
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
        this.overlayDocs.set(this.overlayDocs().filter((d) => d._id !== doc._id));
        const current = this.selected();
        if (current?.user?._id) {
          this.refreshCompliance(current.user._id);
          this.loadEmployees();
          this.loadHistory(current.user._id);
          this.refreshDocAlerts();
        }
        this.showSuccess('Document supprimé.');
      },
      error: (err: any) => {
        this.deletingDocId.set(null);
        this.error.set(err?.message || 'Erreur suppression document');
      }
    });
  }

  openDeleteDocModal(doc: EmployeeDoc): void {
    this.pendingDocId.set(doc._id);
    this.pendingDoc.set(doc);
    const label = doc.detail || doc.type || 'Document';
    this.pendingDocName.set(label);
    this.pendingDocLabel.set('document');
    this.deleteDocModalOpen.set(true);
  }

  closeDeleteDocModal(): void {
    if (this.confirmingDeleteDoc()) return;
    this.deleteDocModalOpen.set(false);
    this.pendingDocId.set(null);
    this.pendingDoc.set(null);
    this.pendingDocName.set('');
  }

  confirmDeleteDoc(): void {
    const id = this.pendingDocId();
    if (!id) return;
    const doc = this.pendingDoc() || this.docs().find((d) => d._id === id) || this.overlayDocs().find((d) => d._id === id);
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
          const items = result?.items || [];
          this.history.set(this.sortHistory(items));
          this.historyTotal.set(result?.total || 0);
        },
        error: (err: any) => this.error.set(err?.message || 'Erreur chargement historique')
      });
  }

  private sortHistory(items: HrHistoryItem[]): HrHistoryItem[] {
    const sort = this.historySort();
    const list = [...items];
    const byText = (value: string) => this.normalizeSort(value);
    const compareText = (a: string, b: string) => byText(a).localeCompare(byText(b), 'fr');
    const dateVal = (h: HrHistoryItem) => new Date(h.createdAt || 0).getTime();
    const actionVal = (h: HrHistoryItem) => this.historyActionLabel(h.action);
    const authorVal = (h: HrHistoryItem) => this.formatUserName(h.actor);
    const detailVal = (h: HrHistoryItem) => this.historyDetail(h);
    list.sort((a, b) => {
      switch (sort) {
        case 'DATE_ASC':
          return dateVal(a) - dateVal(b);
        case 'ACTION_ASC':
          return compareText(actionVal(a), actionVal(b));
        case 'AUTHOR_ASC':
          return compareText(authorVal(a), authorVal(b));
        case 'DETAIL_ASC':
          return compareText(detailVal(a), detailVal(b));
        case 'DATE_DESC':
        default:
          return dateVal(b) - dateVal(a);
      }
    });
    return list;
  }

  toggleHistorySort(field: 'DATE' | 'ACTION' | 'AUTHOR' | 'DETAIL'): void {
    const current = this.historySort();
    let next = current;
    if (field === 'DATE') {
      next = current === 'DATE_DESC' ? 'DATE_ASC' : 'DATE_DESC';
    } else if (field === 'ACTION') {
      next = 'ACTION_ASC';
    } else if (field === 'AUTHOR') {
      next = 'AUTHOR_ASC';
    } else if (field === 'DETAIL') {
      next = 'DETAIL_ASC';
    }
    if (next === current) return;
    this.historySort.set(next);
    this.history.set(this.sortHistory(this.history()));
  }

  isHistorySort(field: 'DATE' | 'ACTION' | 'AUTHOR' | 'DETAIL'): boolean {
    const current = this.historySort();
    if (field === 'DATE') return current === 'DATE_DESC' || current === 'DATE_ASC';
    if (field === 'ACTION') return current === 'ACTION_ASC';
    if (field === 'AUTHOR') return current === 'AUTHOR_ASC';
    return current === 'DETAIL_ASC';
  }

  historySortArrow(field: 'DATE' | 'ACTION' | 'AUTHOR' | 'DETAIL'): string {
    const current = this.historySort();
    if (field === 'DATE') return current === 'DATE_ASC' ? '▲' : '▼';
    if (!this.isHistorySort(field)) return '';
    return '▲';
  }

  refreshDocAlerts(): void {
    this.hr.listDocAlerts(30).subscribe({
      next: (alerts) => this.docAlerts.set(alerts),
      error: (err: any) => this.error.set(err?.message || 'Erreur chargement alertes docs')
    });
  }

  private showSuccess(message: string): void {
    this.success.set(message);
    if (this.successTimer) {
      window.clearTimeout(this.successTimer);
    }
    this.successTimer = window.setTimeout(() => {
      this.success.set(null);
      this.successTimer = null;
    }, 3000);
  }

  prevHistoryPage(): void {
    const next = Math.max(1, this.historyPage() - 1);
    this.historyPage.set(next);
    this.reloadSelectedHistory();
  }

  nextHistoryPage(): void {
    const totalPages = Math.max(1, Math.ceil(this.historyTotal() / this.historyLimit()));
    const next = Math.min(totalPages, this.historyPage() + 1);
    this.historyPage.set(next);
    this.reloadSelectedHistory();
  }

  setHistoryLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.historyLimit.set(value);
    this.historyPage.set(1);
    this.reloadSelectedHistory();
  }

  loadLeaves(): void {
    const status = this.leaveStatus();
    this.leavePage.set(1);
    this.absences.list(status ? { status } : undefined).subscribe({
      next: (resp) => this.leaves.set(resp?.data || []),
      error: (err: any) => this.error.set(err?.message || 'Erreur chargement congés')
    });
  }

  prevLeavePage(): void {
    const next = Math.max(1, this.leavePage() - 1);
    this.leavePage.set(next);
  }

  nextLeavePage(): void {
    const totalPages = this.leavePageCount();
    const next = Math.min(totalPages, this.leavePage() + 1);
    this.leavePage.set(next);
  }

  setLeaveLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.leaveLimit.set(value);
    this.leavePage.set(1);
  }

  setLeaveSort(value: string): void {
    const next = value as 'EMP_ASC' | 'DEPOT_ASC' | 'TYPE_ASC' | 'PERIOD_ASC' | 'STATUS_ASC';
    if (next === this.leaveSort()) return;
    this.leaveSort.set(next);
    this.leavePage.set(1);
  }

  decideLeave(leave: Absence, decision: AbsenceStatus): void {
    if (!leave?._id) return;
    this.absences.updateStatus(leave._id, decision).subscribe({
      next: (resp) => {
        const updated = resp?.data;
        if (!updated?._id) return;
        this.leaves.set(this.leaves().map((l) => (l._id === updated._id ? updated : l)));
      },
      error: (err: any) => this.error.set(err?.message || 'Erreur décision congé')
    });
  }

  formatUserName(user?: any): string {
    if (!user) return '—';
    return formatPersonName(user.firstName || '', user.lastName || '') || user.email || '—';
  }

  absenceTechnician(absence: Absence): User | undefined {
    return (absence.technician as User) || (absence.createdBy as User);
  }

  absenceTypeLabel(type?: string): string {
    return type ? (ABSENCE_TYPE_LABELS[type] || type) : '—';
  }

  absenceStatusLabel(status?: AbsenceStatus): string {
    return status ? (ABSENCE_STATUS_LABELS[status] || status) : '—';
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

  openDoc(doc: EmployeeDoc): void {
    this.hr.downloadDoc(doc._id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      },
      error: async (err) => {
        this.error.set(await this.readDownloadError(err));
      }
    });
  }

  private async readDownloadError(err: any): Promise<string> {
    const payload = err?.error;
    if (payload instanceof Blob) {
      try {
        const text = await payload.text();
        const parsed = JSON.parse(text);
        return parsed?.message || 'Téléchargement document impossible.';
      } catch {
        return 'Téléchargement document impossible.';
      }
    }
    return payload?.message || 'Téléchargement document impossible.';
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
    this.scrollToElement('hr-employee-profile');
  }

  scrollToPayslip(): void {
    this.scrollToElement('hr-payslip');
  }

  private reloadSelectedPayslips(): void {
    const userId = this.selected()?.user?._id;
    if (userId) this.loadPayslips(userId);
  }

  private reloadSelectedHistory(): void {
    const userId = this.selected()?.user?._id;
    if (userId) this.loadHistory(userId);
  }

  private scrollToElement(id: string): void {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
