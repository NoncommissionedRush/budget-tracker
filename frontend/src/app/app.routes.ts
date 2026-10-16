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
