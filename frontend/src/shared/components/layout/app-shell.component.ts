import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomNavComponent } from './bottom-nav.component';
import { TopBarComponent } from './top-bar.component';
import { IncomeService } from '../../../services/income.service';
import { CategoryService } from '../../../services/category.service';
import { DashboardService } from '../../../services/dashboard.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, BottomNavComponent, TopBarComponent],
  template: `
    <div class="flex flex-col min-h-screen bg-[var(--color-surface)]">
      <app-top-bar />
      <main class="flex-1 overflow-y-auto pb-20 md:pb-0">
        <router-outlet />
      </main>
      <app-bottom-nav class="md:hidden" />
    </div>
  `,
})
export class AppShellComponent implements OnInit {
  private readonly incomeService = inject(IncomeService);
  private readonly categoryService = inject(CategoryService);
  private readonly dashboardService = inject(DashboardService);

  ngOnInit() {
    this.incomeService.loadIncomeConfig().subscribe();
    this.categoryService.loadCategories().subscribe();
    this.dashboardService.loadDashboard().subscribe();
  }
}
