import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { switchMap, map } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { DashboardService } from './dashboard.service';
import {
  CreateExpenseDto,
  ExpenseQuery,
  PaginatedExpenses,
  UpdateExpenseDto,
} from '../core/models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly dashboardService = inject(DashboardService);

  getExpenses(query: ExpenseQuery = {}) {
    let params = new HttpParams();
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.page) params = params.set('page', query.page.toString());
    if (query.limit) params = params.set('limit', query.limit.toString());

    return this.http.get<PaginatedExpenses>(`${environment.apiUrl}/expenses`, {
      params,
    });
  }

  createExpense(dto: CreateExpenseDto) {
    return this.http
      .post<unknown>(`${environment.apiUrl}/expenses`, dto)
      .pipe(
        switchMap(() =>
          this.dashboardService.loadDashboard().pipe(map(() => void 0))
        )
      );
  }

  updateExpense(id: string, dto: UpdateExpenseDto) {
    return this.http
      .patch<unknown>(`${environment.apiUrl}/expenses/${id}`, dto)
      .pipe(
        switchMap(() =>
          this.dashboardService.loadDashboard().pipe(map(() => void 0))
        )
      );
  }

  deleteExpense(id: string) {
    return this.http
      .delete<void>(`${environment.apiUrl}/expenses/${id}`)
      .pipe(
        switchMap(() =>
          this.dashboardService.loadDashboard().pipe(map(() => void 0))
        )
      );
  }
}
