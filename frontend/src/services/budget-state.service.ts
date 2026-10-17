import { Injectable, computed, signal } from '@angular/core';
import { IncomeConfig } from '../core/models/income.model';
import { Category } from '../core/models/category.model';
import { DashboardData } from '../core/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class BudgetStateService {
  private readonly _incomeConfig = signal<IncomeConfig | null>(null);
  private readonly _categories = signal<Category[]>([]);
  private readonly _dashboardData = signal<DashboardData | null>(null);
  private readonly _isLoadingDashboard = signal(false);
  /** null = the period containing today, as resolved by the backend */
  private readonly _selectedPeriod = signal<{ year: number; month: number } | null>(null);

  readonly incomeConfig = this._incomeConfig.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly dashboardData = this._dashboardData.asReadonly();
  readonly isLoadingDashboard = this._isLoadingDashboard.asReadonly();
  readonly selectedPeriod = this._selectedPeriod.asReadonly();

  readonly hasIncomeConfig = computed(() => this._incomeConfig() !== null);
  readonly hasCategories = computed(() => this._categories().some((c) => !c.isUnbudgeted));
  readonly isSetupComplete = computed(
    () => this.hasIncomeConfig() && this.hasCategories()
  );
  readonly totalAllocated = computed(() =>
    this._categories()
      .filter((c) => !c.isUnbudgeted)
      .reduce((sum, c) => sum + parseFloat(c.allocatedAmount), 0)
  );

  setIncomeConfig(config: IncomeConfig | null): void {
    this._incomeConfig.set(config);
  }

  setCategories(categories: Category[]): void {
    this._categories.set(categories);
  }

  addCategory(category: Category): void {
    this._categories.update((cats) => [...cats, category]);
  }

  updateCategory(updated: Category): void {
    this._categories.update((cats) =>
      cats.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  removeCategory(id: string): void {
    this._categories.update((cats) => cats.filter((c) => c.id !== id));
  }

  setDashboardData(data: DashboardData | null): void {
    this._dashboardData.set(data);
  }

  setLoadingDashboard(loading: boolean): void {
    this._isLoadingDashboard.set(loading);
  }

  setPeriod(year: number, month: number): void {
    this._selectedPeriod.set({ year, month });
  }
}
