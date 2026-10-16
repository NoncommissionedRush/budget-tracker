import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { BudgetStateService } from './budget-state.service';
import { IncomeConfig } from '../core/models/income.model';

@Injectable({ providedIn: 'root' })
export class IncomeService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(BudgetStateService);

  loadIncomeConfig() {
    return this.http
      .get<IncomeConfig | null>(`${environment.apiUrl}/income`)
      .pipe(tap((config) => this.state.setIncomeConfig(config)));
  }

  upsertIncomeConfig(monthlyAmount: number, incomeDay: number) {
    return this.http
      .put<IncomeConfig>(`${environment.apiUrl}/income`, { monthlyAmount, incomeDay })
      .pipe(tap((config) => this.state.setIncomeConfig(config)));
  }
}
