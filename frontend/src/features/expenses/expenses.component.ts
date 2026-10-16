import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ExpenseService } from '../../services/expense.service';
import { BudgetStateService } from '../../services/budget-state.service';
import { CurrencyEurPipe } from '../../shared/pipes/currency-format.pipe';
import { Expense, PaginatedExpenses } from '../../core/models/expense.model';
import { SubcategorySummary } from '../../core/models/dashboard.model';

const ICON_PATHS: Record<string, string> = {
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  heart: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 4.875 10.5 9.625 10.5 9.625s8.25-4.75 8.25-9.625z',
  'shopping-cart': 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
  'credit-card': 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  'device-phone-mobile': 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3',
  // kept for backward compatibility with existing categories
  'academic-cap': 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3z M6 6h.008v.008H6V6z',
  coffee: 'M6.75 4.5h10.5v13.5a2.25 2.25 0 01-2.25 2.25H9a2.25 2.25 0 01-2.25-2.25V4.5zm10.5 0h.75A2.25 2.25 0 0120.25 6.75v1.5A2.25 2.25 0 0118 10.5h-.75M6.75 4.5H6A2.25 2.25 0 003.75 6.75v.75',
  burger: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  car: 'M2 9.5h20v7H2v-7zM6 9.5l2.5-4.5h7L18 9.5H6zM9.5 16.5a2 2 0 11-4 0 2 2 0 014 0zm9 0a2 2 0 11-4 0 2 2 0 014 0z',
};

@Component({
  selector: 'app-expenses',
  imports: [CommonModule, NgTemplateOutlet, ReactiveFormsModule, CurrencyEurPipe],
  template: `
    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Expenses</h1>
        <button (click)="openAddForm()"
          class="w-10 h-10 bg-[var(--color-brand-500)] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[var(--color-brand-600)] transition-colors">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      <!-- Add/Edit Expense Modal -->
      @if (showForm()) {
        <div class="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center md:justify-center"
          (click)="closeForm()">
          <div class="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-lg font-semibold text-gray-900">
                {{ editingExpense() ? 'Edit Expense' : 'Add Expense' }}
              </h2>
              <button (click)="closeForm()" class="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form [formGroup]="expenseForm" (ngSubmit)="saveExpense()">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Amount (€)</label>
                <input
                  type="number"
                  formControlName="amount"
                  class="w-full px-4 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-2xl font-bold text-center"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                />
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                @if (state.categories().length === 0) {
                  <p class="text-sm text-gray-400">No categories. Add them in Setup first.</p>
                } @else {
                  <div class="grid grid-cols-2 gap-2">
                    @for (cat of state.categories(); track cat.id) {
                      <button type="button"
                        (click)="selectCategory(cat.id)"
                        class="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left"
                        [class]="expenseForm.value.categoryId === cat.id
                          ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)]'
                          : 'border-gray-200 hover:border-gray-300'">
                        <div class="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          [style.background-color]="cat.color + '30'">
                          <svg class="w-3.5 h-3.5" [style.color]="cat.color" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="getIconPath(cat.icon)" />
                          </svg>
                        </div>
                        <span class="text-sm font-medium text-gray-800 truncate">{{ cat.name }}</span>
                      </button>
                    }
                  </div>
                }
              </div>

              <!-- Subcategory pills -->
              @if (selectedCategorySubcats().length > 0) {
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    Subcategory <span class="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div class="flex flex-wrap gap-2">
                    @for (sub of selectedCategorySubcats(); track sub.id) {
                      <button type="button"
                        (click)="selectSubcategory(sub)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all"
                        [class]="selectedSubcategoryId() === sub.id
                          ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]'
                          : sub.isPaid
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'">
                        <span>{{ sub.name }}</span>
                        <span class="opacity-70">€{{ sub.amount }}</span>
                        @if (sub.isPaid) {
                          <svg class="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        }
                      </button>
                    }
                  </div>
                  @if (selectedSubIsPaid()) {
                    <div class="mt-2 flex items-center gap-1.5 text-amber-700 text-sm bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                      <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      <span>Already paid this period — still log it?</span>
                    </div>
                  }
                </div>
              }

              <div class="mb-4 relative">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <input
                  type="text"
                  formControlName="description"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                  placeholder="What did you spend on?"
                  (input)="onDescriptionInput($event)"
                  (focus)="showSuggestions.set(true)"
                  (blur)="hideSuggestionsDelayed()"
                  autocomplete="off"
                />
                @if (showSuggestions() && descriptionSuggestions().length > 0) {
                  <div class="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    @for (suggestion of descriptionSuggestions(); track suggestion) {
                      <button type="button"
                        (mousedown)="selectSuggestion(suggestion)"
                        class="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                        <svg class="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {{ suggestion }}
                      </button>
                    }
                  </div>
                }
              </div>
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  formControlName="expenseDate"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
                />
              </div>
              <div class="flex gap-3">
                <button type="button" (click)="closeForm()"
                  class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" [disabled]="expenseForm.invalid || isSaving()"
                  class="flex-1 py-3 bg-[var(--color-brand-500)] text-white rounded-xl font-semibold hover:bg-[var(--color-brand-600)] disabled:opacity-50 transition-colors">
                  {{ isSaving() ? 'Saving...' : (editingExpense() ? 'Update' : 'Add') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Search + filter bar -->
      <div class="mb-5 space-y-3">
        <!-- Search input -->
        <div class="relative">
          <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
          </svg>
          <input
            type="text"
            placeholder="Search expenses..."
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-sm"
          />
          @if (searchQuery()) {
            <button (click)="searchQuery.set('')"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        </div>

        <!-- Category filter pills -->
        <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            (click)="filterCategoryId.set(null)"
            class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
            [class]="filterCategoryId() === null
              ? 'bg-[var(--color-brand-500)] text-white border-[var(--color-brand-500)]'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'">
            All
          </button>
          @for (cat of state.categories(); track cat.id) {
            <button
              (click)="filterCategoryId.set(cat.id)"
              class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
              [class]="filterCategoryId() === cat.id
                ? 'text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'"
              [style.background-color]="filterCategoryId() === cat.id ? cat.color : ''">
              <div class="w-2 h-2 rounded-full flex-shrink-0"
                [style.background-color]="filterCategoryId() === cat.id ? 'rgba(255,255,255,0.7)' : cat.color"></div>
              {{ cat.name }}
            </button>
          }
        </div>

        <!-- Sort buttons -->
        <div class="flex gap-1.5">
          @for (opt of sortOptions; track opt.value) {
            <button
              (click)="sortOrder.set(opt.value)"
              class="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all"
              [class]="sortOrder() === opt.value
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'">
              {{ opt.label }}
            </button>
          }
        </div>
      </div>

      <!-- Filtered total -->
      @if ((searchQuery() || filterCategoryId()) && filteredExpenses().length > 0) {
        <div class="mb-4 px-4 py-3 bg-gray-50 rounded-xl flex items-center justify-between border border-gray-100">
          <span class="text-sm text-gray-500">{{ filteredExpenses().length }} expense{{ filteredExpenses().length === 1 ? '' : 's' }}</span>
          <span class="text-sm font-bold text-gray-900">Total: {{ filteredTotal() | currencyEur }}</span>
        </div>
      }

      <!-- Loading skeleton -->
      @if (isLoading()) {
        <div class="space-y-3">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
              <div class="flex gap-3">
                <div class="w-10 h-10 bg-gray-100 rounded-xl"></div>
                <div class="flex-1">
                  <div class="h-4 bg-gray-100 rounded w-1/3 mb-2"></div>
                  <div class="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
                <div class="h-4 bg-gray-100 rounded w-16"></div>
              </div>
            </div>
          }
        </div>
      } @else if (filteredExpenses().length === 0) {
        <div class="text-center py-16">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          @if (searchQuery() || filterCategoryId()) {
            <p class="text-gray-500 font-medium">No matching expenses</p>
            <p class="text-gray-400 text-sm mt-1">Try adjusting your search or filter</p>
          } @else {
            <p class="text-gray-500 font-medium">No expenses yet</p>
            <p class="text-gray-400 text-sm mt-1">Tap + to record your first expense</p>
          }
        </div>
      } @else if (isAmountSort()) {
        <!-- Flat list sorted by amount -->
        <div class="space-y-2">
          @for (expense of flatSortedExpenses(); track expense.id) {
            <ng-container *ngTemplateOutlet="expenseRow; context: { $implicit: expense, showDate: true }" />
          }
        </div>
      } @else {
        <!-- Grouped by date (newest / oldest) -->
        <div class="space-y-5">
          @for (group of groupedExpenses(); track group.date) {
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {{ group.label }}
              </p>
              <div class="space-y-2">
                @for (expense of group.expenses; track expense.id) {
                  <ng-container *ngTemplateOutlet="expenseRow; context: { $implicit: expense, showDate: false }" />
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Expense row template -->
    <ng-template #expenseRow let-expense let-showDate="showDate">
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          [style.background-color]="(expense.category?.color || '#6366f1') + '20'">
          <svg class="w-5 h-5" [style.color]="expense.category?.color || '#6366f1'"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round"
              [attr.d]="getIconPath(expense.category?.icon || 'tag')" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-900 truncate">{{ expense.description }}</p>
          <p class="text-sm text-gray-400">
            {{ expense.category?.name || 'Unknown' }}
            @if (showDate) { · {{ formatDate(expense.expenseDate) }} }
          </p>
        </div>
        <p class="font-bold text-gray-900 flex-shrink-0">{{ expense.amount | currencyEur }}</p>
        <div class="flex gap-1 flex-shrink-0">
          <button (click)="searchQuery.set(expense.description)"
            [title]="'Filter by: ' + expense.description"
            class="p-1.5 rounded-lg transition-colors"
            [class]="searchQuery() === expense.description
              ? 'text-[var(--color-brand-500)] bg-[var(--color-brand-50)]'
              : 'text-gray-300 hover:text-[var(--color-brand-500)] hover:bg-[var(--color-brand-50)]'">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
          </button>
          <button (click)="startEdit(expense)"
            class="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button (click)="deleteExpense(expense.id)"
            class="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    </ng-template>
  `,
})
export class ExpensesComponent implements OnInit {
  readonly state = inject(BudgetStateService);
  private readonly expenseService = inject(ExpenseService);
  private readonly fb = inject(FormBuilder);

  readonly showForm = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly editingExpense = signal<Expense | null>(null);
  private readonly _expenses = signal<Expense[]>([]);

  // ─── Filter / sort state ────────────────────────────────────────────────────
  readonly searchQuery = signal('');
  readonly filterCategoryId = signal<string | null>(null);
  readonly sortOrder = signal<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // ─── Description autocomplete ────────────────────────────────────────────────
  private readonly _descriptionQuery = signal('');
  readonly showSuggestions = signal(false);

  // Tracks the currently selected category id as a reactive signal
  // (mirrors expenseForm.value.categoryId but is signal-based for computed())
  private readonly _selectedCategoryId = signal<string>('');
  readonly selectedSubcategoryId = signal<string | null>(null);

  readonly expenseForm = this.fb.group({
    categoryId: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    description: ['', Validators.required],
    expenseDate: [new Date().toISOString().split('T')[0], Validators.required],
  });

  /** Subcategories for the selected category, with isPaid from dashboard state */
  readonly selectedCategorySubcats = computed((): SubcategorySummary[] => {
    const catId = this._selectedCategoryId();
    if (!catId) return [];

    // Prefer dashboard data since it carries isPaid status
    const dashboard = this.state.dashboardData();
    if (dashboard) {
      const catSummary = dashboard.categories.find((c) => c.id === catId);
      return catSummary?.subcategories ?? [];
    }

    // Fallback to categories state (no isPaid info available yet)
    const cat = this.state.categories().find((c) => c.id === catId);
    return (cat?.subcategories ?? []).map((sub) => ({
      id: sub.id,
      name: sub.name,
      amount: sub.amount,
      isPaid: false,
      paidExpenseId: null,
    }));
  });

  /** True when the currently selected subcategory is already paid this period */
  readonly selectedSubIsPaid = computed(() => {
    const subId = this.selectedSubcategoryId();
    if (!subId) return false;
    return this.selectedCategorySubcats().find((s) => s.id === subId)?.isPaid ?? false;
  });

  /** Top descriptions used for the selected category, filtered by current input */
  readonly descriptionSuggestions = computed(() => {
    const catId = this._selectedCategoryId();
    if (!catId) return [];
    const query = this._descriptionQuery().trim().toLowerCase();
    const freqMap = new Map<string, number>();
    for (const e of this._expenses()) {
      if (e.categoryId !== catId) continue;
      freqMap.set(e.description, (freqMap.get(e.description) ?? 0) + 1);
    }
    return [...freqMap.entries()]
      .filter(([desc]) => !query || desc.toLowerCase().includes(query))
      .sort((a, b) => b[1] - a[1])
      .map(([desc]) => desc)
      .slice(0, 5);
  });

  /** All expenses after search + category filter applied */
  readonly filteredExpenses = computed(() => {
    let list = this._expenses();
    const q = this.searchQuery().trim().toLowerCase();
    const catId = this.filterCategoryId();
    if (q) list = list.filter((e) => e.description.toLowerCase().includes(q));
    if (catId) list = list.filter((e) => e.categoryId === catId);
    return list;
  });

  /** Sum of all filtered expenses */
  readonly filteredTotal = computed(() =>
    this.filteredExpenses().reduce((sum, e) => sum + parseFloat(e.amount), 0)
  );

  /** True when the active sort is by amount (use flat list instead of grouped) */
  readonly isAmountSort = computed(() => {
    const s = this.sortOrder();
    return s === 'highest' || s === 'lowest';
  });

  /** Flat list sorted by amount – used when isAmountSort() is true */
  readonly flatSortedExpenses = computed(() => {
    const list = [...this.filteredExpenses()];
    if (this.sortOrder() === 'highest') {
      return list.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
    }
    return list.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
  });

  /** Date-grouped list – used for newest/oldest sorts */
  readonly groupedExpenses = computed(() => {
    const expenses = this.filteredExpenses();
    if (expenses.length === 0) return [];

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const grouped = new Map<string, Expense[]>();
    for (const e of expenses) {
      const key = e.expenseDate;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    const groups: { date: string; label: string; expenses: Expense[] }[] = [];
    for (const [date, exps] of grouped) {
      let label: string;
      if (date === today) label = 'Today';
      else if (date === yesterday) label = 'Yesterday';
      else {
        const d = new Date(date + 'T00:00:00');
        label = d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      }
      groups.push({ date, label, expenses: exps });
    }
    const sorted = groups.sort((a, b) => b.date.localeCompare(a.date));
    return this.sortOrder() === 'oldest' ? sorted.reverse() : sorted;
  });

  readonly sortOptions: { value: 'newest' | 'oldest' | 'highest' | 'lowest'; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'highest', label: 'Highest' },
    { value: 'lowest', label: 'Lowest' },
  ];

  ngOnInit() {
    this.loadExpenses();
  }

  loadExpenses() {
    this.isLoading.set(true);
    this.expenseService.getExpenses({ limit: 100 }).subscribe({
      next: (result: PaginatedExpenses) => {
        this._expenses.set(result.data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  /** Select a category; resets subcategory selection */
  selectCategory(catId: string) {
    this._selectedCategoryId.set(catId);
    this.expenseForm.patchValue({ categoryId: catId });
    this.selectedSubcategoryId.set(null);
  }

  /** Toggle a subcategory pill; pre-fills amount + description when selected */
  selectSubcategory(sub: SubcategorySummary) {
    if (this.selectedSubcategoryId() === sub.id) {
      this.selectedSubcategoryId.set(null);
      return;
    }
    this.selectedSubcategoryId.set(sub.id);
    this._descriptionQuery.set(sub.name);
    this.expenseForm.patchValue({
      amount: parseFloat(sub.amount),
      description: sub.name,
    });
  }

  openAddForm() {
    this.editingExpense.set(null);
    this._selectedCategoryId.set('');
    this.selectedSubcategoryId.set(null);
    this._descriptionQuery.set('');
    this.showSuggestions.set(false);
    this.expenseForm.reset({
      expenseDate: new Date().toISOString().split('T')[0],
    });
    this.showForm.set(true);
  }

  startEdit(expense: Expense) {
    this.editingExpense.set(expense);
    this._selectedCategoryId.set(expense.categoryId);
    this.selectedSubcategoryId.set(expense.subcategoryId ?? null);
    this._descriptionQuery.set(expense.description);
    this.showSuggestions.set(false);
    this.expenseForm.patchValue({
      categoryId: expense.categoryId,
      amount: parseFloat(expense.amount),
      description: expense.description,
      expenseDate: expense.expenseDate,
    });
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingExpense.set(null);
    this._selectedCategoryId.set('');
    this.selectedSubcategoryId.set(null);
    this._descriptionQuery.set('');
    this.showSuggestions.set(false);
    this.expenseForm.reset({ expenseDate: new Date().toISOString().split('T')[0] });
  }

  saveExpense() {
    if (this.expenseForm.invalid) return;
    const v = this.expenseForm.value;
    const subId = this.selectedSubcategoryId();
    this.isSaving.set(true);

    const editing = this.editingExpense();
    const obs = editing
      ? this.expenseService.updateExpense(editing.id, {
          categoryId: v.categoryId!,
          subcategoryId: subId,        // null clears the link; string updates it
          amount: v.amount!,
          description: v.description!,
          expenseDate: v.expenseDate!,
        })
      : this.expenseService.createExpense({
          categoryId: v.categoryId!,
          subcategoryId: subId ?? undefined,   // omit when not selected
          amount: v.amount!,
          description: v.description!,
          expenseDate: v.expenseDate!,
        });

    obs.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeForm();
        this.loadExpenses();
      },
      error: () => this.isSaving.set(false),
    });
  }

  deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    this.expenseService.deleteExpense(id).subscribe({
      next: () => this.loadExpenses(),
    });
  }

  onDescriptionInput(event: Event) {
    this._descriptionQuery.set((event.target as HTMLInputElement).value);
    this.showSuggestions.set(true);
  }

  hideSuggestionsDelayed() {
    setTimeout(() => this.showSuggestions.set(false), 150);
  }

  selectSuggestion(description: string) {
    this.expenseForm.patchValue({ description });
    this._descriptionQuery.set(description);
    this.showSuggestions.set(false);
  }

  getIconPath(iconId: string): string {
    return ICON_PATHS[iconId] ?? ICON_PATHS['tag'];
  }

  formatDate(dateStr: string): string {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  }
}
