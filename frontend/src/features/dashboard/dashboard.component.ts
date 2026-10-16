import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgxApexchartsModule } from 'ngx-apexcharts';
import { BudgetStateService } from '../../services/budget-state.service';
import { DashboardService } from '../../services/dashboard.service';
import { CategoryService } from '../../services/category.service';
import { CategorySummary } from '../../core/models/dashboard.model';
import { CurrencyEurPipe } from '../../shared/pipes/currency-format.pipe';
import { ProgressBarComponent } from '../../shared/components/ui/progress-bar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgxApexchartsModule, CurrencyEurPipe, ProgressBarComponent],
  template: `
    <div class="min-h-screen bg-gray-50 pb-20 md:pb-6">
      <!-- Period Navigation -->
      <div class="bg-white border-b border-gray-100 px-4 py-3">
        <div class="max-w-5xl mx-auto flex items-center justify-between">
          <button
            (click)="navigatePeriod(-1)"
            class="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Previous period">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="text-center">
            @if (dashboardData()?.period) {
              <p class="text-sm font-semibold text-gray-900">{{ formatPeriodLabel() }}</p>
              <p class="text-xs text-gray-500">{{ formatPeriodRange() }}</p>
            } @else {
              <p class="text-sm font-medium text-gray-500">Loading...</p>
            }
          </div>
          <button
            (click)="navigatePeriod(1)"
            [disabled]="isCurrentPeriod()"
            class="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next period">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div class="max-w-5xl mx-auto px-4 pt-4 space-y-4">

        <!-- Setup Prompt -->
        @if (!isSetupComplete()) {
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <div class="w-14 h-14 rounded-2xl bg-[var(--color-brand-50)] flex items-center justify-center mx-auto mb-4">
              <svg class="w-7 h-7 text-[var(--color-brand-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Set up your budget</h3>
            <p class="text-sm text-gray-500 mb-5">Add your monthly income and budget categories to get started.</p>
            <button
              (click)="goToSetup()"
              class="bg-[var(--color-brand-500)] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[var(--color-brand-600)] transition-colors">
              Get Started
            </button>
          </div>
        }

        <!-- Loading Skeleton -->
        @if (isLoading() && isSetupComplete()) {
          <div class="animate-pulse space-y-4">
            <div class="bg-white rounded-2xl h-44 shadow-sm"></div>
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-white rounded-2xl h-32 shadow-sm"></div>
              <div class="bg-white rounded-2xl h-32 shadow-sm"></div>
            </div>
            <div class="bg-white rounded-2xl h-52 shadow-sm"></div>
          </div>
        }

        @if (!isLoading() && isSetupComplete() && dashboardData()) {
          <!-- Summary Header Card -->
          <div class="rounded-2xl overflow-hidden shadow-sm"
            style="background: linear-gradient(135deg, var(--color-brand-500) 0%, #0284c7 100%)">
            <div class="p-5 text-white">
              <p class="text-sm font-medium text-blue-100 mb-1">Total Remaining</p>
              <p class="text-4xl font-bold mb-1">{{ dashboardData()!.summary!.totalRemaining | currencyEur }}</p>
              <p class="text-sm text-blue-100 mb-4">
                of {{ dashboardData()!.summary!.totalAllocated | currencyEur }} allocated
              </p>

              <!-- Overall progress bar -->
              <div class="bg-white/20 rounded-full h-2 mb-3">
                <div
                  class="h-2 rounded-full transition-all duration-700"
                  [class]="getOverallBarClass()"
                  [style.width.%]="clamp(dashboardData()!.summary!.spentPercentage, 0, 100)">
                </div>
              </div>

              <div class="flex justify-between text-xs text-blue-100">
                <span>{{ dashboardData()!.summary!.spentPercentage | number:'1.0-0' }}% spent</span>
                <span>{{ dashboardData()!.period!.daysRemaining }} days remaining</span>
              </div>
            </div>

            <!-- Stats row -->
            <div class="grid grid-cols-3 border-t border-white/20">
              <div class="p-3 text-center border-r border-white/20">
                <p class="text-xs text-blue-100 mb-0.5">Spent</p>
                <p class="text-sm font-semibold text-white">{{ dashboardData()!.summary!.totalSpent | currencyEur }}</p>
              </div>
              <div class="p-3 text-center border-r border-white/20">
                <p class="text-xs text-blue-100 mb-0.5">Projected</p>
                <p class="text-sm font-semibold text-white">{{ dashboardData()!.summary!.projectedTotalSpend | currencyEur }}</p>
              </div>
              <div class="p-3 text-center">
                <p class="text-xs text-blue-100 mb-0.5">Surplus</p>
                <p class="text-sm font-semibold text-white">{{ dashboardData()!.summary!.unallocatedAmount | currencyEur }}</p>
              </div>
            </div>
          </div>

          <!-- Charts Row -->
          @if (donutOptions && areaOptions) {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Donut Chart -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h3 class="text-sm font-semibold text-gray-700 mb-1">Budget Breakdown</h3>
                <apx-chart
                  [series]="donutOptions.series!"
                  [chart]="donutOptions.chart!"
                  [labels]="donutOptions.labels!"
                  [colors]="donutOptions.colors!"
                  [legend]="donutOptions.legend!"
                  [plotOptions]="donutOptions.plotOptions!"
                  [dataLabels]="donutOptions.dataLabels!"
                  [tooltip]="donutOptions.tooltip!">
                </apx-chart>
              </div>

              <!-- Area Chart -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h3 class="text-sm font-semibold text-gray-700 mb-2">Daily Spending</h3>
                <!-- Category filter pills -->
                <div class="flex gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-hide">
                  <button
                    (click)="selectedChartCategoryId.set(null)"
                    class="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                    [class]="selectedChartCategoryId() === null
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'">
                    All
                  </button>
                  @for (cat of dashboardData()!.categories; track cat.id) {
                    <button
                      (click)="selectedChartCategoryId.set(cat.id)"
                      class="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all"
                      [class]="selectedChartCategoryId() === cat.id
                        ? 'text-white border-transparent'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'"
                      [style.background-color]="selectedChartCategoryId() === cat.id ? cat.color : ''">
                      <div class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        [style.background-color]="selectedChartCategoryId() === cat.id ? 'rgba(255,255,255,0.8)' : cat.color"></div>
                      {{ cat.name }}
                    </button>
                  }
                </div>
                <apx-chart
                  [series]="areaOptions.series!"
                  [chart]="areaOptions.chart!"
                  [xaxis]="areaOptions.xaxis!"
                  [yaxis]="areaOptions.yaxis!"
                  [colors]="areaOptions.colors!"
                  [fill]="areaOptions.fill!"
                  [stroke]="areaOptions.stroke!"
                  [grid]="areaOptions.grid!"
                  [dataLabels]="areaOptions.dataLabels!"
                  [tooltip]="areaOptions.tooltip!">
                </apx-chart>
              </div>
            </div>
          }

          <!-- Category Cards -->
          @if (orderedCategories().length > 0) {
            <div>
              <h2 class="text-base font-semibold text-gray-900 mb-3">Categories</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                @for (cat of orderedCategories(); track cat.id) {
                  <div class="bg-white rounded-2xl shadow-sm border-2 p-4 transition-all select-none"
                    draggable="true"
                    (dragstart)="onDragStart(cat.id)"
                    (dragover)="onDragOver($event, cat.id)"
                    (drop)="onDrop(cat.id)"
                    (dragend)="onDragEnd()"
                    [class.opacity-40]="draggingId() === cat.id"
                    [class.border-[var(--color-brand-400)]]="dragOverId() === cat.id && draggingId() !== cat.id"
                    [class.border-gray-100]="dragOverId() !== cat.id || draggingId() === cat.id"
                    [class.shadow-lg]="dragOverId() === cat.id && draggingId() !== cat.id"
                    [class.opacity-50]="!cat.isActiveThisPeriod && draggingId() !== cat.id">
                    <!-- Category header -->
                    <div class="flex items-center gap-3 mb-3">
                      <!-- Drag handle -->
                      <svg class="w-4 h-4 text-gray-200 flex-shrink-0 cursor-grab" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="5" cy="4" r="1.5"/><circle cx="11" cy="4" r="1.5"/>
                        <circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/>
                        <circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="12" r="1.5"/>
                      </svg>
                      <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        [style.background-color]="cat.color + '20'">
                        <span [style.color]="cat.color" class="text-lg">{{ getCategoryEmoji(cat.icon) }}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-900 truncate">{{ cat.name }}</p>
                        @if (!cat.isUnbudgeted) {
                          <p class="text-xs text-gray-500">
                            {{ cat.spentAmount | currencyEur }} of {{ cat.allocatedAmount | currencyEur }}
                          </p>
                        } @else {
                          <p class="text-xs text-orange-400">Unbudgeted</p>
                        }
                      </div>
                      <!-- Status badge -->
                      @if (cat.isUnbudgeted) {
                        <!-- no badge for unbudgeted -->
                      } @else if (!cat.isActiveThisPeriod) {
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 bg-gray-100 text-gray-400">
                          Not this period
                        </span>
                      } @else {
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                          [class]="getStatusBadgeClass(cat.status)">
                          {{ cat.status === 'ok' ? '✓' : cat.status === 'warning' ? '!' : '!!' }}
                        </span>
                      }
                    </div>

                    <!-- Progress bar (budgeted categories only) -->
                    @if (!cat.isUnbudgeted) {
                      <app-progress-bar [percentage]="cat.spentPercentage"></app-progress-bar>
                    }

                    <!-- Unbudgeted: just show total spent -->
                    @if (cat.isUnbudgeted) {
                      <div class="mt-1">
                        <p class="text-xs text-gray-400">Spent this period</p>
                        <p class="text-base font-bold" [style.color]="cat.color">{{ cat.spentAmount | currencyEur }}</p>
                      </div>
                    <!-- Remaining + Projected (budgeted active categories) -->
                    } @else if (cat.isActiveThisPeriod) {
                      <div class="flex justify-between mt-2">
                        <div>
                          <p class="text-xs text-gray-400">Remaining</p>
                          <p class="text-sm font-semibold"
                            [class.text-[var(--color-budget-ok)]]="cat.status === 'ok'"
                            [class.text-[var(--color-budget-warning)]]="cat.status === 'warning'"
                            [class.text-[var(--color-budget-over)]]="cat.status === 'over'">
                            {{ cat.remainingAmount | currencyEur }}
                          </p>
                        </div>
                        <div class="text-right">
                          <p class="text-xs text-gray-400">Projected</p>
                          <p class="text-sm font-semibold text-gray-700">{{ cat.projectedSpend | currencyEur }}</p>
                        </div>
                      </div>
                    } @else {
                      <!-- Inactive budgeted: show only actual spent -->
                      @if (+cat.spentAmount > 0) {
                        <div class="mt-2">
                          <p class="text-xs text-gray-400">Spent this period</p>
                          <p class="text-sm font-semibold text-amber-600">{{ cat.spentAmount | currencyEur }}</p>
                        </div>
                      }
                    }

                    <!-- Subcategory breakdown -->
                    @if (cat.subcategories.length > 0) {
                      <div class="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                        @for (sub of cat.subcategories; track sub.id) {
                          <div class="flex items-center justify-between">
                            <p class="text-xs text-gray-600 truncate flex-1 mr-2">{{ sub.name }}</p>
                            <div class="flex items-center gap-2 flex-shrink-0">
                              <span class="text-xs font-medium text-gray-700">{{ sub.amount | currencyEur }}</span>
                              @if (sub.isPaid) {
                                <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                  Paid
                                </span>
                              } @else {
                                <span class="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                                  Unpaid
                                </span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <!-- Recent expenses (up to 3); hidden when subcategories handle the breakdown -->
                    @if (cat.expenses.length > 0 && cat.subcategories.length === 0) {
                      <div class="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                        @for (exp of cat.expenses.slice(0, 3); track exp.id) {
                          <div class="flex items-center justify-between">
                            <p class="text-xs text-gray-500 truncate flex-1 mr-2">{{ exp.description }}</p>
                            <p class="text-xs font-medium text-gray-700 flex-shrink-0">{{ exp.amount | currencyEur }}</p>
                          </div>
                        }
                        @if (cat.expenses.length > 3) {
                          <p class="text-xs text-gray-400">+{{ cat.expenses.length - 3 }} more</p>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          } @else if (dashboardData()!.categories.length === 0) {
            <!-- Empty state: setup complete but no categories -->
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
              <p class="text-sm text-gray-500">No active categories. Add categories in Setup.</p>
              <button
                (click)="goToSetup()"
                class="mt-3 text-sm font-medium text-[var(--color-brand-500)] hover:underline">
                Go to Setup →
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly state = inject(BudgetStateService);
  private readonly dashboardService = inject(DashboardService);
  private readonly categoryService = inject(CategoryService);
  private readonly router = inject(Router);

  readonly dashboardData = this.state.dashboardData;
  readonly isLoading = this.state.isLoadingDashboard;
  readonly isSetupComplete = this.state.isSetupComplete;

  // ─── Drag-to-reorder state ──────────────────────────────────────────────────
  readonly orderedCategories = signal<CategorySummary[]>([]);
  readonly draggingId = signal<string | null>(null);
  readonly dragOverId = signal<string | null>(null);

  // ─── Daily spending chart filter ────────────────────────────────────────────
  readonly selectedChartCategoryId = signal<string | null>(null);

  donutOptions: any = null;
  areaOptions: any = null;

  constructor() {
    // Sync ordered list + donut chart whenever dashboard data changes
    effect(() => {
      const data = this.dashboardData();
      if (data?.summary && data?.categories) {
        this.orderedCategories.set([...data.categories]);
        this.buildDonutChart(data);
      }
    });

    // Rebuild area chart whenever data OR selected category changes
    effect(() => {
      const data = this.dashboardData();
      const catId = this.selectedChartCategoryId();
      if (data?.categories) {
        this.buildAreaChart(data, catId);
      }
    });
  }

  ngOnInit(): void {
    const period = this.state.selectedPeriod();
    this.dashboardService.loadDashboard(period.year, period.month).subscribe();
  }

  navigatePeriod(delta: number): void {
    const current = this.state.selectedPeriod();
    let { year, month } = current;
    month += delta;
    if (month > 12) { month = 1; year++; }
    if (month < 1) { month = 12; year--; }
    this.selectedChartCategoryId.set(null);
    this.state.setPeriod(year, month);
    this.dashboardService.loadDashboard(year, month).subscribe();
  }

  isCurrentPeriod(): boolean {
    const now = new Date();
    const period = this.state.selectedPeriod();
    return period.year === now.getFullYear() && period.month === (now.getMonth() + 1);
  }

  formatPeriodLabel(): string {
    const period = this.dashboardData()?.period;
    if (!period) return '';
    const date = new Date(period.year, period.month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  formatPeriodRange(): string {
    const period = this.dashboardData()?.period;
    if (!period) return '';
    const start = new Date(period.periodStart);
    const end = new Date(period.periodEnd);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }

  getOverallBarClass(): string {
    const pct = this.dashboardData()?.summary?.spentPercentage ?? 0;
    if (pct >= 100) return 'bg-red-400';
    if (pct >= 75) return 'bg-amber-400';
    return 'bg-green-400';
  }

  getStatusBadgeClass(status: 'ok' | 'warning' | 'over'): string {
    if (status === 'over') return 'bg-red-50 text-red-600';
    if (status === 'warning') return 'bg-amber-50 text-amber-600';
    return 'bg-green-50 text-green-600';
  }

  getCategoryEmoji(icon: string): string {
    const map: Record<string, string> = {
      home: '🏠', groceries: '🛒', food: '🍔', transport: '🚗', car: '🚗',
      health: '💊', fitness: '💪', entertainment: '🎬', shopping: '🛍️',
      utilities: '💡', phone: '📱', internet: '🌐', education: '📚',
      travel: '✈️', pets: '🐾', subscriptions: '📡', savings: '💰',
      clothing: '👕', beauty: '💄', gifts: '🎁', sports: '⚽', tag: '🏷️',
      coffee: '☕', burger: '🍔', 'device-phone-mobile': '📱',
      'shopping-cart': '🛒', 'credit-card': '💳', 'academic-cap': '🎓',
    };
    return map[icon] ?? '🏷️';
  }

  clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
  }

  // ─── Drag-to-reorder handlers ───────────────────────────────────────────────
  onDragStart(catId: string): void {
    this.draggingId.set(catId);
  }

  onDragOver(event: DragEvent, catId: string): void {
    event.preventDefault();
    if (this.draggingId() !== catId) {
      this.dragOverId.set(catId);
    }
  }

  onDrop(toCatId: string): void {
    const fromId = this.draggingId();
    this.draggingId.set(null);
    this.dragOverId.set(null);
    if (!fromId || fromId === toCatId) return;

    const items = [...this.orderedCategories()];
    const fromIdx = items.findIndex((c) => c.id === fromId);
    const toIdx = items.findIndex((c) => c.id === toCatId);
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    this.orderedCategories.set(items);
    this.categoryService.reorderCategories(items.map((c) => c.id)).subscribe();
  }

  onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverId.set(null);
  }

  goToSetup(): void {
    this.router.navigate(['/setup']);
  }

  private buildDonutChart(data: ReturnType<typeof this.dashboardData>): void {
    if (!data?.summary) return;
    const budgetedSpent = parseFloat(data.summary.budgetedSpent) || 0;
    const unbudgetedSpent = parseFloat(data.summary.unbudgetedSpent) || 0;
    const remaining = Math.max(parseFloat(data.summary.totalRemaining) || 0, 0);
    const surplus = Math.max(parseFloat(data.summary.unallocatedAmount) || 0, 0);

    const hasUnbudgeted = unbudgetedSpent > 0;

    const series = hasUnbudgeted
      ? [budgetedSpent, remaining, unbudgetedSpent, surplus]
      : [budgetedSpent, remaining, surplus];
    const labels = hasUnbudgeted
      ? ['Budget Spent', 'Remaining', 'Unexpected', 'Surplus']
      : ['Spent', 'Remaining', 'Surplus'];
    const colors = hasUnbudgeted
      ? ['#ef4444', '#22c55e', '#f97316', '#e5e7eb']
      : ['#ef4444', '#22c55e', '#e5e7eb'];

    this.donutOptions = {
      series,
      chart: { type: 'donut', height: 200, toolbar: { show: false }, animations: { enabled: true } },
      labels,
      colors,
      legend: { position: 'bottom', fontSize: '12px' },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Budget used',
                formatter: () => `${data.summary!.spentPercentage.toFixed(0)}%`,
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      tooltip: {
        y: {
          formatter: (val: number) =>
            new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val),
        },
      },
    };
  }

  private buildAreaChart(data: ReturnType<typeof this.dashboardData>, filterCatId: string | null = null): void {
    if (!data?.period || !data?.categories) return;

    const cats = filterCatId
      ? data.categories.filter((c) => c.id === filterCatId)
      : data.categories;

    const selectedCat = filterCatId ? data.categories.find((c) => c.id === filterCatId) : null;
    const chartColor = selectedCat?.color ?? '#0ea5e9';

    // Aggregate daily spending from selected categories' expenses
    const dailyMap = new Map<string, number>();
    for (const cat of cats) {
      for (const exp of cat.expenses) {
        const day = exp.expenseDate.substring(0, 10);
        dailyMap.set(day, (dailyMap.get(day) ?? 0) + parseFloat(exp.amount));
      }
    }

    const sortedDays = Array.from(dailyMap.keys()).sort();
    const amounts = sortedDays.map(d => dailyMap.get(d)!);

    this.areaOptions = {
      series: [{ name: 'Spent', data: amounts }],
      chart: { type: 'area', height: 200, toolbar: { show: false }, sparkline: { enabled: false } },
      xaxis: {
        categories: sortedDays.map(d => {
          const dt = new Date(d + 'T00:00:00');
          return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        labels: { show: sortedDays.length > 0, rotate: -45, style: { fontSize: '10px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { fontSize: '10px' },
          formatter: (val: number) => `€${val.toFixed(0)}`,
        },
      },
      colors: [chartColor],
      fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
      stroke: { curve: 'smooth', width: 2 },
      grid: { borderColor: '#f3f4f6', strokeDashArray: 4 },
      dataLabels: { enabled: false },
      tooltip: {
        y: {
          formatter: (val: number) =>
            new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val),
        },
      },
    };
  }
}
