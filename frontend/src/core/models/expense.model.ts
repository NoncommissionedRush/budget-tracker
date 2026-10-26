export interface Expense {
  id: string;
  categoryId: string;
  subcategoryId?: string | null;
  amount: string;
  description: string;
  expenseDate: string;
  source?: 'MANUAL' | 'IMPORT';
  bankTransactionId?: string | null;
  createdAt: string;
  category?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
}

export interface CreateExpenseDto {
  categoryId: string;
  subcategoryId?: string;
  amount: number;
  description: string;
  expenseDate: string;
}

export interface UpdateExpenseDto {
  categoryId?: string;
  subcategoryId?: string | null;
  amount?: number;
  description?: string;
  expenseDate?: string;
}

export interface ExpenseQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedExpenses {
  data: Expense[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
