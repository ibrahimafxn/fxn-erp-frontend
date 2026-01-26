import { CommonModule, DatePipe } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RevenueService, RevenueAttachment, RevenueItem, RevenueSummaryPoint, RevenueUser } from '../../../core/services/revenue.service';
import { environment } from '../../../environments/environment';
import { ConfirmDeleteModal } from '../../../shared/components/dialog/confirm-delete-modal/confirm-delete-modal';

@Component({
  standalone: true,
  selector: 'app-revenue-dashboard',
  imports: [CommonModule, ReactiveFormsModule, DatePipe, ConfirmDeleteModal],
  templateUrl: './revenue-dashboard.html',
  styleUrls: ['./revenue-dashboard.scss']
})
export class RevenueDashboard {
  private revenue = inject(RevenueService);
  private fb = inject(FormBuilder);

  @ViewChild('revenueFiles') private revenueFiles?: ElementRef<HTMLInputElement>;

  readonly loading = signal(false);
  readonly error = signal<string | undefined>(undefined);
  readonly items = signal<RevenueItem[]>([]);
  readonly total = signal(0);
  readonly summaryTotal = signal(0);
  readonly summaryPenaltyTotal = signal(0);
  readonly series = signal<RevenueSummaryPoint[]>([]);
  readonly selectedPeriodLabel = signal('Toutes périodes');
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly totalCount = signal(0);
  readonly pageCount = computed(() => {
    const t = this.totalCount();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.pageCount());
  readonly editing = signal<RevenueItem | null>(null);
  readonly deleteModalOpen = signal(false);
  readonly pendingDelete = signal<RevenueItem | null>(null);
  readonly deleting = signal(false);
  readonly fileError = signal<string | null>(null);
  readonly attachmentDeleting = signal<string | null>(null);
  readonly openAttachmentRows = signal<Set<string>>(new Set());
  readonly canEditManual = computed(() => {
    const selected = this.selectedAttachments().length > 0;
    const existing = (this.editing()?.attachments?.length || 0) > 0;
    return selected || existing;
  });

  readonly filterForm = this.fb.nonNullable.group({
    month: this.fb.nonNullable.control(''),
    year: this.fb.nonNullable.control(''),
    period: this.fb.nonNullable.control('')
  });

  readonly createForm = this.fb.nonNullable.group({
    month: this.fb.nonNullable.control(this.currentMonthValue(), [Validators.required]),
    year: this.fb.nonNullable.control(this.currentYearValue(), [Validators.required]),
    amountHt: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    penalty: this.fb.nonNullable.control(0),
    note: this.fb.nonNullable.control('')
  });

  readonly maxAmount = computed(() => {
    const values = this.series().map((s) => s.amountHt || 0);
    const max = Math.max(...values, 0);
    return max || 1;
  });

  readonly maxCumulative = computed(() => {
    const values = this.series().map((s) => s.cumulativeHt || 0);
    const max = Math.max(...values, 0);
    return max || 1;
  });


  constructor() {
    this.loadAll(false);
    this.loadSummarySeries();
    this.loadSummaryTotal(false);
    this.updatePeriodLabel();
  }

  readonly selectedAttachments = signal<File[]>([]);
  private readonly maxAttachmentCount = 10;
  private readonly maxAttachmentSize = 10 * 1024 * 1024;
  private readonly allowedAttachmentTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);

  readonly yearOptions = computed(() => {
    const current = new Date().getFullYear();
    const start = current - 5;
    const end = current + 2;
    const years: number[] = [];
    for (let y = start; y <= end; y += 1) years.push(y);
    return years;
  });

  readonly monthOptions = computed(() => ([
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' }
  ]));

  readonly periodOptions = [
    { value: '', label: 'Personnalisée' },
    { value: '3m', label: '3 derniers mois' },
    { value: '6m', label: '6 derniers mois' },
    { value: '12m', label: '12 derniers mois' },
    { value: 'ytd', label: 'Depuis janvier' }
  ];

  loadAll(refreshSummary = false): void {
    const { month, year, period } = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(undefined);

    const presetRange = this.buildPresetRange(period);
    const monthKey = presetRange ? '' : this.buildMonthKey(month, year);
    const fromMonth = presetRange?.from || monthKey || undefined;
    const toMonth = presetRange?.to || monthKey || undefined;
    const monthNumber = presetRange ? 0 : (month ? Number(month) : 0);
    const yearNumber = presetRange ? 0 : (year ? Number(year) : 0);
    const monthOnly = !presetRange && monthNumber && !yearNumber;

    this.revenue.list({
      from: monthOnly ? undefined : fromMonth || undefined,
      to: monthOnly ? undefined : toMonth || undefined,
      month: monthOnly ? monthNumber : undefined,
      year: yearNumber || undefined,
      page: this.page(),
      limit: this.limit()
    }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur chargement CA');
          this.loading.set(false);
          return;
        }
        this.items.set(res.data.items || []);
        this.total.set(res.data.total || 0);
        this.totalCount.set(res.data.totalCount || 0);
        if (refreshSummary) {
          this.loadSummarySeries();
        } else {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur chargement CA');
      }
    });
  }

  loadSummarySeries(): void {
    const { month, year, period } = this.filterForm.getRawValue();
    const presetRange = this.buildPresetRange(period);
    const monthKey = presetRange ? '' : this.buildMonthKey(month, year);
    const fromMonth = presetRange?.from || monthKey || undefined;
    const toMonth = presetRange?.to || monthKey || undefined;
    const monthNumber = presetRange ? 0 : (month ? Number(month) : 0);
    const yearNumber = presetRange ? 0 : (year ? Number(year) : 0);
    const monthOnly = !presetRange && monthNumber && !yearNumber;
    this.revenue.summary({
      from: monthOnly ? undefined : fromMonth || undefined,
      to: monthOnly ? undefined : toMonth || undefined,
      month: monthOnly ? monthNumber : undefined,
      year: yearNumber || undefined
    }).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur synthèse CA');
          this.loading.set(false);
          return;
        }
        this.series.set(res.data.series || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur synthèse CA');
      }
    });
  }

  loadSummaryTotal(useFilters: boolean): void {
    const { month, year, period } = this.filterForm.getRawValue();
    const presetRange = useFilters ? this.buildPresetRange(period) : null;
    const monthKey = presetRange ? '' : (useFilters ? this.buildMonthKey(month, year) : '');
    const fromMonth = presetRange?.from || monthKey || undefined;
    const toMonth = presetRange?.to || monthKey || undefined;
    const monthNumber = useFilters && !presetRange ? (month ? Number(month) : 0) : 0;
    const yearNumber = useFilters && !presetRange ? (year ? Number(year) : 0) : 0;
    const monthOnly = useFilters && !presetRange && monthNumber && !yearNumber;
    this.revenue.summary({
      from: useFilters ? (monthOnly ? undefined : fromMonth || undefined) : undefined,
      to: useFilters ? (monthOnly ? undefined : toMonth || undefined) : undefined,
      month: useFilters ? (monthOnly ? monthNumber : undefined) : undefined,
      year: useFilters ? (yearNumber || undefined) : undefined
    }).subscribe({
      next: (res) => {
        if (!res?.success) return;
        this.summaryTotal.set(res.data.total || 0);
        const penaltyTotal = (res.data.series || []).reduce((sum, point) => sum + Number(point.penalty || 0), 0);
        this.summaryPenaltyTotal.set(penaltyTotal);
      },
      error: () => {}
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadAll(true);
    this.loadSummaryTotal(true);
    this.updatePeriodLabel();
  }

  clearFilters(): void {
    this.filterForm.setValue({ month: '', year: '', period: '' });
    this.page.set(1);
    this.loadAll(true);
    this.loadSummaryTotal(true);
    this.updatePeriodLabel();
  }

  reloadGlobal(): void {
    this.page.set(1);
    this.loadAll(false);
    this.loadSummaryTotal(false);
    this.selectedPeriodLabel.set('Toutes périodes');
  }

  submit(): void {
    if (this.createForm.invalid) return;
    const raw = this.createForm.getRawValue();
    const year = Number(raw.year);
    const month = Number(raw.month);
    if (!year || !month) {
      this.error.set('Période invalide.');
      return;
    }
    this.loading.set(true);
    this.error.set(undefined);
    const payload = {
      year,
      month,
      amountHt: Number(raw.amountHt),
      penalty: Number(raw.penalty || 0),
      note: raw.note?.trim() || undefined
    };

    const editing = this.editing();
    const hasAttachments = this.selectedAttachments().length > 0;
    const request$ = editing
      ? (hasAttachments
        ? this.revenue.updateWithAttachments(editing._id, payload, this.selectedAttachments())
        : this.revenue.update(editing._id, payload))
      : (hasAttachments
        ? this.revenue.upsertWithAttachments(payload, this.selectedAttachments())
        : this.revenue.upsert(payload));

    request$.subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur sauvegarde CA');
          this.loading.set(false);
          return;
        }
        this.resetCreateForm();
        this.editing.set(null);
        this.loadAll(true);
        this.loadSummaryTotal(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Erreur sauvegarde CA');
      }
    });
  }

  openDeleteModal(item: RevenueItem): void {
    this.pendingDelete.set(item);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) return;
    this.deleting.set(true);
    this.error.set(undefined);
    this.revenue.remove(item._id).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.error.set(res?.message || 'Erreur suppression CA');
          this.deleting.set(false);
          return;
        }
        this.deleting.set(false);
        this.closeDeleteModal();
        this.loadAll(true);
        this.loadSummaryTotal(true);
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err?.error?.message || 'Erreur suppression CA');
      }
    });
  }

  formatMonth(item: RevenueItem | RevenueSummaryPoint): string {
    const month = String(item.month).padStart(2, '0');
    return `${item.year}-${month}`;
  }

  formatMonthShort(item: RevenueItem | RevenueSummaryPoint): string {
    const label = this.monthOptions().find((m) => m.value === String(item.month).padStart(2, '0'))?.label;
    const short = label ? label.slice(0, 3) : String(item.month).padStart(2, '0');
    return `${short} ${String(item.year).slice(-2)}`;
  }

  isCurrentMonth(point: RevenueSummaryPoint): boolean {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return point.month === month && point.year === year;
  }

  tooltipLabel(point: RevenueSummaryPoint): string {
    return `${this.formatMonth(point)} · HT: ${this.formatCurrency(point.amountHt)} · Cumul: ${this.formatCurrency(point.cumulativeHt)}`;
  }

  authorLabel(user?: RevenueUser | null): string {
    if (!user) return '—';
    const first = user.firstName || '';
    const last = user.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || user.email || '—';
  }

  startEdit(item: RevenueItem): void {
    this.createForm.setValue({
      month: String(item.month).padStart(2, '0'),
      year: String(item.year),
      amountHt: Number(item.amountHt || 0),
      penalty: Number(item.penalty || 0),
      note: item.note || ''
    });
    this.editing.set(item);
    this.resetAttachmentInput();
  }

  cancelEdit(): void {
    this.resetCreateForm();
    this.editing.set(null);
  }

  prevPage(): void {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.loadAll();
  }

  nextPage(): void {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.loadAll();
  }

  setLimit(event: Event): void {
    const el = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!el) return;
    const v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return;
    this.limit.set(v);
    this.page.set(1);
    this.loadAll();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
      .format(value || 0);
  }

  formatCompactCurrency(value: number): string {
    const v = Number(value || 0);
    if (v >= 1_000_000) return `${this.roundCompact(v / 1_000_000)}M €`;
    if (v >= 1_000) return `${this.roundCompact(v / 1_000)}k €`;
    return `${Math.round(v)} €`;
  }

  amountHeight(point: RevenueSummaryPoint): string {
    return `${this.percent(point.amountHt || 0, this.maxAmount())}%`;
  }

  cumulativeHeight(point: RevenueSummaryPoint): string {
    return `${this.percent(point.cumulativeHt || 0, this.maxCumulative())}%`;
  }

  onAttachmentClick(): void {
    const input = this.revenueFiles?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.selectedAttachments.set([]);
    this.fileError.set(null);
  }

  onAttachmentChange(event: Event): void {
    const el = event.target instanceof HTMLInputElement ? event.target : null;
    const files = el?.files ? Array.from(el.files) : [];
    this.fileError.set(null);
    if (!files.length) {
      this.selectedAttachments.set([]);
      return;
    }
    if (files.length > this.maxAttachmentCount) {
      this.fileError.set(`Maximum ${this.maxAttachmentCount} fichiers.`);
    }
    const filtered = files.slice(0, this.maxAttachmentCount).filter((file) => {
      if (!this.isAllowedAttachment(file)) return false;
      if (file.size > this.maxAttachmentSize) return false;
      return true;
    });
    const oversized = files.find((file) => file.size > this.maxAttachmentSize);
    if (oversized) {
      this.fileError.set(`"${oversized.name}" dépasse 10 Mo.`);
    }
    const invalid = files.find((file) => !this.isAllowedAttachment(file));
    if (invalid) {
      this.fileError.set(`"${invalid.name}" n'est pas un format autorisé.`);
    }
    this.selectedAttachments.set(filtered);
    this.previewPenaltyFromFiles(filtered);
  }

  removeAttachment(index: number): void {
    this.selectedAttachments.set(this.selectedAttachments().filter((_file, i) => i !== index));
  }

  removeExistingAttachment(attachment: RevenueAttachment): void {
    const current = this.editing();
    if (!current) return;
    const filename = attachment.filename;
    if (!filename) return;
    this.attachmentDeleting.set(filename);
    this.fileError.set(null);
    this.revenue.removeAttachment(current._id, filename).subscribe({
      next: (res) => {
        this.attachmentDeleting.set(null);
        if (!res?.success) {
          this.fileError.set(res?.message || 'Erreur suppression facture');
          return;
        }
        const updated = res.data;
        if (updated) {
          this.editing.set(updated);
          this.items.set(this.items().map((item) => (item._id === updated._id ? updated : item)));
        } else {
          this.loadAll();
        }
      },
      error: (err) => {
        this.attachmentDeleting.set(null);
        this.fileError.set(err?.error?.message || 'Erreur suppression facture');
      }
    });
  }

  toggleRowAttachments(id: string): void {
    const next = new Set(this.openAttachmentRows());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.openAttachmentRows.set(next);
  }

  isRowAttachmentsOpen(id: string): boolean {
    return this.openAttachmentRows().has(id);
  }

  editingAttachments(): RevenueAttachment[] {
    return this.editing()?.attachments || [];
  }

  attachmentLabel(attachment: RevenueAttachment): string {
    const raw = attachment.originalName || attachment.filename || 'Facture';
    return raw.replace(/NÂ°/g, 'N°').replace(/NÂº/g, 'N°');
  }

  penaltyNoteLabel(note?: string | null): string {
    const raw = String(note || '').trim();
    if (!raw) return '—';
    const match = raw.match(/PEN_[A-Z0-9_]+(?:\s*\d+)?/i);
    return match ? match[0].replace(/\s+/g, ' ').trim() : raw;
  }

  attachmentDownloadUrl(itemId: string, attachment: RevenueAttachment): string | null {
    const filename = attachment.filename || '';
    if (!itemId || !filename) return null;
    return `${environment.apiBaseUrl}/revenue/${itemId}/attachments/${encodeURIComponent(filename)}/download`;
  }

  openAttachment(itemId: string, attachment: RevenueAttachment): void {
    const filename = attachment.filename || '';
    if (!itemId || !filename) return;
    this.revenue.downloadAttachment(itemId, filename).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.fileError.set('Téléchargement impossible.');
      }
    });
  }

  formatFileSize(bytes: number): string {
    const size = Number(bytes || 0);
    if (size >= 1024 * 1024) return `${Math.round(size / (1024 * 1024))} Mo`;
    if (size >= 1024) return `${Math.round(size / 1024)} Ko`;
    return `${size} o`;
  }

  private buildMonthKey(month: string, year: string): string {
    const monthValue = String(month || '').padStart(2, '0');
    const yearValue = String(year || '').trim();
    if (!monthValue || !yearValue) return '';
    return `${yearValue}-${monthValue}`;
  }

  private buildPresetRange(preset: string): { from: string; to: string } | null {
    if (!preset) return null;
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;
    let startYear = endYear;
    let startMonth = endMonth;

    if (preset === 'ytd') {
      startMonth = 1;
    } else {
      const span = preset === '3m' ? 3 : preset === '6m' ? 6 : preset === '12m' ? 12 : 0;
      if (!span) return null;
      let offset = span - 1;
      while (offset > 0) {
        startMonth -= 1;
        if (startMonth < 1) {
          startMonth = 12;
          startYear -= 1;
        }
        offset -= 1;
      }
    }

    const from = `${startYear}-${String(startMonth).padStart(2, '0')}`;
    const to = `${endYear}-${String(endMonth).padStart(2, '0')}`;
    return { from, to };
  }

  private currentMonthValue(): string {
    return String(new Date().getMonth() + 1).padStart(2, '0');
  }

  private currentYearValue(): string {
    return String(new Date().getFullYear());
  }

  private resetCreateForm(): void {
    this.createForm.reset({
      month: this.currentMonthValue(),
      year: this.currentYearValue(),
      amountHt: 0,
      penalty: 0,
      note: ''
    });
    this.resetAttachmentInput();
  }

  private percent(value: number, max: number): number {
    if (!max || !Number.isFinite(value)) return 0;
    const pct = (Math.max(0, value) / max) * 100;
    return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
  }

  private roundCompact(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  }

  private updatePeriodLabel(): void {
    const { month, year, period } = this.filterForm.getRawValue();
    if (period) {
      const label = this.periodOptions.find((p) => p.value === period)?.label;
      this.selectedPeriodLabel.set(label || 'Période sélectionnée');
      return;
    }
    const monthLabel = this.monthOptions().find((m) => m.value === String(month).padStart(2, '0'))?.label;
    if (monthLabel && year) {
      this.selectedPeriodLabel.set(`${monthLabel} ${year}`);
      return;
    }
    if (year) {
      this.selectedPeriodLabel.set(String(year));
      return;
    }
    if (monthLabel) {
      this.selectedPeriodLabel.set(monthLabel);
      return;
    }
    this.selectedPeriodLabel.set('Toutes périodes');
  }

  private resetAttachmentInput(): void {
    const input = this.revenueFiles?.nativeElement;
    if (input) {
      input.value = '';
    }
    this.selectedAttachments.set([]);
    this.fileError.set(null);
    this.attachmentDeleting.set(null);
  }

  private isAllowedAttachment(file: File): boolean {
    if (this.allowedAttachmentTypes.has(file.type)) return true;
    const name = file.name.toLowerCase();
    return name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
  }

  private previewPenaltyFromFiles(files: File[]): void {
    if (!files.length) return;
    this.revenue.previewPenalty(files).subscribe({
      next: (res) => {
        if (!res?.success) return;
        const value = Number(res.data?.penalty ?? 0);
        if (Number.isFinite(value)) {
          this.createForm.controls.penalty.setValue(value);
        }
        const amount = Number(res.data?.amountHt ?? NaN);
        if (Number.isFinite(amount)) {
          this.createForm.controls.amountHt.setValue(amount);
        }
        const note = String(res.data?.note || '').trim();
        const noteCtrl = this.createForm.controls.note;
        if (note && !String(noteCtrl.value || '').trim()) {
          noteCtrl.setValue(note);
        }
        const month = Number(res.data?.month ?? 0);
        const year = Number(res.data?.year ?? 0);
        if (Number.isFinite(month) && month > 0 && month <= 12) {
          this.createForm.controls.month.setValue(String(month).padStart(2, '0'));
        }
        if (Number.isFinite(year) && year > 0) {
          this.createForm.controls.year.setValue(String(year));
        }
      },
      error: () => {}
    });
  }
}
