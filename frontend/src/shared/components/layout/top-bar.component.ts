import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div class="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-[var(--color-brand-500)] flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="font-semibold text-gray-900">Budget</span>
        </div>
        <!-- Desktop nav -->
        <nav class="hidden md:flex items-center gap-1">
          <a routerLink="/dashboard" routerLinkActive="bg-[var(--color-brand-50)] text-[var(--color-brand-600)]"
            class="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Dashboard
          </a>
          <a routerLink="/expenses" routerLinkActive="bg-[var(--color-brand-50)] text-[var(--color-brand-600)]"
            class="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Expenses
          </a>
          <a routerLink="/setup" routerLinkActive="bg-[var(--color-brand-50)] text-[var(--color-brand-600)]"
            class="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Setup
          </a>
        </nav>
      </div>
    </header>
  `,
})
export class TopBarComponent {}
