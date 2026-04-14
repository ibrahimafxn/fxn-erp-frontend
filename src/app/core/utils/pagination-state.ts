import { computed, signal, WritableSignal, Signal } from '@angular/core';
import { preferredPageSize } from './page-size';
import { formatPageRange } from './pagination';

/**
 * Reusable pagination state for server-side paginated lists.
 * Exposes the same signal/computed names used across all paginated components
 * so templates remain unchanged when components delegate to this class.
 */
export class PaginationState {
  readonly page: WritableSignal<number> = signal(1);
  readonly limit: WritableSignal<number>;
  readonly total: WritableSignal<number> = signal(0);
  readonly pageRange = formatPageRange;

  readonly pageCount: Signal<number> = computed(() => {
    const t = this.total();
    const l = this.limit();
    return l > 0 ? Math.max(1, Math.ceil(t / l)) : 1;
  });
  readonly canPrev: Signal<boolean> = computed(() => this.page() > 1);
  readonly canNext: Signal<boolean> = computed(() => this.page() < this.pageCount());

  constructor(initialLimit?: number) {
    this.limit = signal(initialLimit ?? preferredPageSize());
  }

  prevPage(onRefresh?: () => void): void {
    if (!this.canPrev()) return;
    this.page.update(v => v - 1);
    onRefresh?.();
  }

  nextPage(onRefresh?: () => void): void {
    if (!this.canNext()) return;
    this.page.update(v => v + 1);
    onRefresh?.();
  }

  setLimitValue(value: number, onRefresh?: () => void): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.limit.set(value);
    this.page.set(1);
    onRefresh?.();
  }

  resetPage(): void {
    this.page.set(1);
  }
}
