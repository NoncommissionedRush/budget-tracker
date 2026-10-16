import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../environments/environment';
import { BudgetStateService } from './budget-state.service';
import { DashboardData } from '../core/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(BudgetStateService);

  loadDashboard(year?: number, month?: number) {
    const period = this.state.selectedPeriod();
    const y = year ?? period.year;
    const m = month ?? period.month;

    this.state.setLoadingDashboard(true);

    return this.http
      .get<DashboardData>(`${environment.apiUrl}/dashboard`, {
        params: { year: y, month: m },
      })
      .pipe(
        tap((data) => {
          this.state.setDashboardData(data);
          this.state.setLoadingDashboard(false);
        }),
        catchError((err) => {
          this.state.setLoadingDashboard(false);
          return throwError(() => err);
        })
      );
  }
}
