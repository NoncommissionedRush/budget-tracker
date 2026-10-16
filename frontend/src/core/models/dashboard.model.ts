export interface DashboardPeriod {
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  today: string;
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;
}

export interface DashboardSummary {
  totalAllocated: string;
  totalSpent: string;
  budgetedSpent: string;
  unbudgetedSpent: string;
  totalRemaining: string;
  unallocatedAmount: string;
  projectedTotalSpend: string;
  projectedRemainingAtMonthEnd: string;
  spentPercentage: number;
}

export interface SubcategorySummary {
  id: string;
  name: string;
  amount: string;
  isPaid: boolean;
  paidExpenseId: string | null;
}

export interface CategorySummary {
  id: string;
  name: string;
  icon: string;
  color: string;
  activeMonths: number[];
  isActiveThisPeriod: boolean;
  isUnbudgeted: boolean;
  allocatedAmount: string;
  spentAmount: string;
  remainingAmount: string;
  spentPercentage: number;
  projectedSpend: string;
  status: 'ok' | 'warning' | 'over';
  subcategories: SubcategorySummary[];
  expenses: {
    id: string;
    categoryId: string;
    subcategoryId: string | null;
    amount: string;
    description: string;
    expenseDate: string;
    createdAt: string;
  }[];
}

export interface DashboardData {
  period: DashboardPeriod | null;
  income: { monthlyAmount: string } | null;
  summary: DashboardSummary | null;
  categories: CategorySummary[];
}
