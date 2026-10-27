import { Routes } from '@angular/router';
import { AppShellComponent } from '../shared/components/layout/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        title: 'Dashboard',
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('../features/expenses/expenses.component').then(
            (m) => m.ExpensesComponent
          ),
        title: 'Expenses',
      },
      {
        path: 'review',
        loadComponent: () =>
          import('../features/review/review.component').then(
            (m) => m.ReviewComponent
          ),
        title: 'Review',
      },
      {
        path: 'rules',
        loadComponent: () =>
          import('../features/rules/rules.component').then(
            (m) => m.RulesComponent
          ),
        title: 'Rules',
      },
      {
        path: 'import',
        loadComponent: () =>
          import('../features/import/import.component').then(
            (m) => m.ImportComponent
          ),
        title: 'Import',
      },
      {
        path: 'import/history',
        loadComponent: () =>
          import('../features/import/import-history.component').then(
            (m) => m.ImportHistoryComponent
          ),
        title: 'Import history',
      },
      {
        path: 'setup',
        loadComponent: () =>
          import('../features/setup/setup.component').then(
            (m) => m.SetupComponent
          ),
        title: 'Setup',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
