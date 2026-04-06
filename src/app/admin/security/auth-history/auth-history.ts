import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthHistoryService } from '../../../core/services/auth-history.service';
import { AuditLogService, AuditLogItem } from '../../../core/services/audit-log.service';
import { UserService } from '../../../core/services/user.service';
import { AuthHistoryItem, AuthHistoryResult, User } from '../../../core/models';
import { formatPersonName } from '../../../core/utils/text-format';
import { formatPageRange } from '../../../core/utils/pagination';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-auth-history',
  providers: [DatePipe],
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-history.html',
  styleUrls: ['./auth-history.scss']
})
export class AuthHistory {
  private fb = inject(FormBuilder);
  private svc = inject(AuthHistoryService);
  private auditSvc = inject(AuditLogService);
  private usersSvc = inject(UserService);
  private datePipe = inject(DatePipe);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<AuthHistoryResult | null>(null);

  readonly page = signal(1);
  readonly limit = signal(20);
  readonly pageRange = formatPageRange;

  readonly usersResult: Signal<any | null> = this.usersSvc.result;
  readonly users = computed<User[]>(() => this.usersResult()?.items ?? []);
  readonly usersLoading = this.usersSvc.loading;

  readonly filterForm = this.fb.nonNullable.group({
    user: this.fb.nonNullable.control(''),
    action: this.fb.nonNullable.control(''),
    status: this.fb.nonNullable.control(''),
    date: this.fb.nonNullable.control('')
  });

  readonly items = computed<AuthHistoryItem[]>(() => this.result()?.items ?? []);
  readonly total = computed(() => this.result()?.total ?? 0);
  readonly pageCount = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());

  readonly auditOpen = signal(false);
  readonly auditLoading = signal(false);
  readonly auditError = signal<string | null>(null);
  readonly auditItems = signal<AuditLogItem[]>([]);
  readonly auditTitle = signal<string>('');
  readonly auditRange = signal<string>('');
  readonly auditSession = signal<AuthHistoryItem | null>(null);
  readonly auditExtended = signal(false);
  readonly auditSessionId = signal<string | null>(null);

  constructor() {
    this.loadUsers();
    this.refresh();
  }

  loadUsers(): void {
    this.usersSvc.refreshUsers(true, { page: 1, limit: 200 }).subscribe({ error: () => {} });
  }

  refresh(): void {
    const f = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.svc.listHistory({
      user: f.user || undefined,
      action: f.action || undefined,
      status: f.status || undefined,
      date: f.date || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.apiError(err, 'Erreur chargement historique'));
        this.loading.set(false);
      }
    });
  }

  search(): void {
    this.page.set(1);
    this.refresh();
  }

  clearSearch(): void {
    this.filterForm.setValue({ user: '', action: '', status: '', date: '' });
    this.page.set(1);
    this.refresh();
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.refresh();
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.refresh();
  }

  setLimitValue(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    this.refresh();
  }

  userLabel(u: User): string {
    const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
    return name || u.email || u._id;
  }

  itemUserLabel(item: AuthHistoryItem): string {
    const u = item.user as any;
    if (u && typeof u === 'object') {
      const name = formatPersonName(u.firstName ?? '', u.lastName ?? '');
      return name || u.email || item.email || u._id || '—';
    }
    return item.email || '—';
  }

  actionLabel(action: AuthHistoryItem['action']): string {
    return action === 'LOGIN' ? 'Connexion' : 'Déconnexion';
  }

  statusLabel(status: AuthHistoryItem['status'], action?: AuthHistoryItem['action']): string {
    if (!status) return '—';
    if (status === 'SUCCESS') return 'Succès';
    if (status === 'FAIL') return action === 'LOGOUT' ? 'Automatique' : 'Échec';
    return status;
  }

  reasonLabel(reason?: string | null): string {
    if (!reason) return '—';
    switch (reason) {
      case 'REFRESH_EXPIRED':
        return 'Refresh expiré';
      case 'ACCESS_DISABLED':
        return 'Accès désactivé';
      case 'PASSWORD_EXPIRED':
        return 'Mot de passe expiré';
      default:
        return reason;
    }
  }

  dateLabel(value: string | Date | null | undefined): string {
    if (!value) return '—';
    return this.datePipe.transform(value as any, 'short') || '—';
  }

  showSessionActions(item: AuthHistoryItem): void {
    const userId = this.getItemUserId(item);
    if (!userId || item.action !== 'LOGIN' || item.status !== 'SUCCESS') return;

    const from = new Date(item.createdAt as any);
    const to = this.findNextLogoutDate(item) || new Date();
    const userLabel = this.itemUserLabel(item);

    this.auditTitle.set(`Actions CRUD · ${userLabel}`);
    this.auditRange.set(
      `${this.datePipe.transform(from, 'short') || '—'} → ${this.datePipe.transform(to, 'short') || '—'}`
    );
    this.auditOpen.set(true);
    this.auditLoading.set(true);
    this.auditError.set(null);
    this.auditSession.set(item);
    this.auditSessionId.set(item._id || null);
    this.auditExtended.set(false);

    this.loadAudit(userId, from, to);
  }

  closeAudit(): void {
    this.auditOpen.set(false);
    this.auditItems.set([]);
    this.auditError.set(null);
    this.auditTitle.set('');
    this.auditRange.set('');
    this.auditSession.set(null);
    this.auditSessionId.set(null);
    this.auditExtended.set(false);
  }

  extendAuditWindow(): void {
    const session = this.auditSession();
    const userId = session ? this.getItemUserId(session) : null;
    if (!session || !userId) return;
    const from = new Date(session.createdAt as any);
    const to = new Date(from.getTime() + 8 * 60 * 60 * 1000);
    this.auditRange.set(
      `${this.datePipe.transform(from, 'short') || '—'} → ${this.datePipe.transform(to, 'short') || '—'}`
    );
    this.auditExtended.set(true);
    this.loadAudit(userId, from, to);
  }

  locationLabel(item: AuthHistoryItem): string {
    const ip = item.ip || '';
    if (this.isPrivateIp(ip)) return 'Local';
    const country = item.geo?.country || '';
    const city = item.geo?.city || '';
    if (country && city) return `${city}, ${country}`;
    return country || city || '—';
  }

  private isPrivateIp(raw: string): boolean {
    if (!raw) return false;
    let ip = String(raw).trim();
    if (!ip) return false;
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    if (ip === '::1') return true;
    if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true;
    if (ip.startsWith('127.')) return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    const match = ip.match(/^172\\.(\\d+)\\./);
    if (match) {
      const octet = Number(match[1]);
      return octet >= 16 && octet <= 31;
    }
    return false;
  }

  private getItemUserId(item: AuthHistoryItem): string | null {
    const u = item.user as any;
    if (u && typeof u === 'object' && u._id) return String(u._id);
    return null;
  }

  private findNextLogoutDate(item: AuthHistoryItem): Date | null {
    const userId = this.getItemUserId(item);
    if (!userId) return null;
    const baseTime = new Date(item.createdAt as any).getTime();
    const next = this.items()
      .filter((entry) => {
        const entryUser = this.getItemUserId(entry);
        if (!entryUser || entryUser !== userId) return false;
        if (entry.action !== 'LOGOUT') return false;
        const ts = new Date(entry.createdAt as any).getTime();
        return Number.isFinite(ts) && ts >= baseTime;
      })
      .sort((a, b) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime())[0];
    if (!next) return null;
    const nextTime = new Date(next.createdAt as any).getTime();
    // Si un logout survient quasi immédiatement, on considère la session encore active
    if (Number.isFinite(nextTime) && nextTime - baseTime < 2 * 60 * 1000) {
      return null;
    }
    return new Date(next.createdAt as any);
  }

  private loadAudit(userId: string, from: Date, to: Date): void {
    this.auditLoading.set(true);
    this.auditError.set(null);
    this.auditSvc.list({
      user: userId,
      from: from.toISOString(),
      to: to.toISOString(),
      methods: 'POST,PUT,PATCH,DELETE',
      limit: 200
    }).subscribe({
      next: (res) => {
        this.auditItems.set(res.items || []);
        this.auditLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.auditError.set(this.apiError(err, 'Erreur chargement actions'));
        this.auditLoading.set(false);
      }
    });
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    const apiMsg =
      typeof err.error === 'object' && err.error !== null && 'message' in err.error
        ? String((err.error as { message?: unknown }).message ?? '')
        : '';
    return apiMsg || err.message || fallback;
  }
}
