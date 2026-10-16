import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { IncomeService } from '../../services/income.service';
import { CategoryService } from '../../services/category.service';
import { BudgetStateService } from '../../services/budget-state.service';
import { CurrencyEurPipe } from '../../shared/pipes/currency-format.pipe';
import { CreateCategoryDto, Category, Subcategory } from '../../core/models/category.model';

const PRESET_ICONS = [
  { id: 'home', label: 'Home', svg: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
  { id: 'heart', label: 'Health', svg: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 4.875 10.5 9.625 10.5 9.625s8.25-4.75 8.25-9.625z' },
  { id: 'shopping-cart', label: 'Shopping', svg: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z' },
  { id: 'credit-card', label: 'Bills', svg: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { id: 'device-phone-mobile', label: 'Phone', svg: 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3' },
  { id: 'tag', label: 'Other', svg: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3z M6 6h.008v.008H6V6z' },
  { id: 'coffee', label: 'Coffee', svg: 'M6.75 4.5h10.5v13.5a2.25 2.25 0 01-2.25 2.25H9a2.25 2.25 0 01-2.25-2.25V4.5zm10.5 0h.75A2.25 2.25 0 0120.25 6.75v1.5A2.25 2.25 0 0118 10.5h-.75M6.75 4.5H6A2.25 2.25 0 003.75 6.75v.75' },
  { id: 'burger', label: 'Food', svg: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5' },
  { id: 'car', label: 'Transport', svg: 'M2 9.5h20v7H2v-7zM6 9.5l2.5-4.5h7L18 9.5H6zM9.5 16.5a2 2 0 11-4 0 2 2 0 014 0zm9 0a2 2 0 11-4 0 2 2 0 014 0z' },
];

const PRESET_COLORS = [
  '#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e',
  '#eab308', '#f97316', '#ef4444', '#ec4899',
];

const MONTHS = [
  { num: 1, label: 'Jan' }, { num: 2, label: 'Feb' }, { num: 3, label: 'Mar' }, { num: 4, label: 'Apr' },
  { num: 5, label: 'May' }, { num: 6, label: 'Jun' }, { num: 7, label: 'Jul' }, { num: 8, label: 'Aug' },
  { num: 9, label: 'Sep' }, { num: 10, label: 'Oct' }, { num: 11, label: 'Nov' }, { num: 12, label: 'Dec' },
];

@Component({
  selector: 'app-setup',
  imports: [CommonModule, ReactiveFormsModule, CurrencyEurPipe],
  template: `
    <div class="max-w-2xl mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Setup</h1>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        <button
          (click)="activeTab.set('income')"
          [class]="activeTab() === 'income'
            ? 'flex-1 py-2 px-4 rounded-lg bg-white shadow-sm font-medium text-gray-900 text-sm transition-all'
            : 'flex-1 py-2 px-4 rounded-lg font-medium text-gray-500 text-sm transition-all hover:text-gray-700'">
          Income
        </button>
        <button
          (click)="activeTab.set('categories')"
          [class]="activeTab() === 'categories'
            ? 'flex-1 py-2 px-4 rounded-lg bg-white shadow-sm font-medium text-gray-900 text-sm transition-all'
            : 'flex-1 py-2 px-4 rounded-lg font-medium text-gray-500 text-sm transition-all hover:text-gray-700'">
          Categories
        </button>
      </div>

      <!-- Income Tab -->
      @if (activeTab() === 'income') {
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">Monthly Income</h2>
          <p class="text-sm text-gray-500 mb-6">Set your monthly income and the day it arrives.</p>

          <form [formGroup]="incomeForm" (ngSubmit)="saveIncome()">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Monthly Amount (€)</label>
              <input
                type="number"
                formControlName="monthlyAmount"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent text-lg font-semibold"
                placeholder="3600"
                min="0"
                step="0.01"
              />
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Day of Month (income arrives)</label>
              <input
                type="number"
                formControlName="incomeDay"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent"
                placeholder="10"
                min="1"
                max="31"
              />
              <p class="mt-1.5 text-xs text-gray-400">
                Day 1–31. If the month has fewer days, the last day of the month is used.
              </p>
            </div>

            @if (state.incomeConfig()) {
              <div class="mb-4 p-3 bg-[var(--color-brand-50)] rounded-xl">
                <p class="text-sm text-[var(--color-brand-700)]">
                  Current: <strong>{{ state.incomeConfig()!.monthlyAmount | currencyEur }}</strong>
                  on the <strong>{{ state.incomeConfig()!.incomeDay }}th</strong> of each month
                </p>
              </div>
            }

            <button
              type="submit"
              [disabled]="incomeForm.invalid || isSavingIncome()"
              class="w-full py-3 px-6 bg-[var(--color-brand-500)] text-white rounded-xl font-semibold hover:bg-[var(--color-brand-600)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isSavingIncome() ? 'Saving...' : 'Save Income' }}
            </button>
          </form>
        </div>
      }

      <!-- Categories Tab -->
      @if (activeTab() === 'categories') {
        <div>
          <!-- Budget coverage indicator -->
          @if (state.incomeConfig()) {
            <div class="mb-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm text-gray-500">Budget allocated</span>
                <span class="text-sm font-semibold text-gray-900">
                  {{ state.totalAllocated() | currencyEur }} / {{ state.incomeConfig()!.monthlyAmount | currencyEur }}
                </span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  class="h-2 rounded-full transition-all duration-500"
                  [class]="budgetCoveragePercent() > 100
                    ? 'bg-[var(--color-budget-over)]'
                    : 'bg-[var(--color-brand-500)]'"
                  [style.width]="(budgetCoveragePercent() > 100 ? 100 : budgetCoveragePercent()) + '%'"
                ></div>
              </div>
              @if (budgetCoveragePercent() > 100) {
                <p class="text-xs text-[var(--color-budget-over)] mt-1.5">⚠ Total allocation exceeds income</p>
              }
            </div>
          }

          <!-- Categories list -->
          @for (cat of state.categories(); track cat.id) {
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
              @if (editingId() === cat.id) {
                <form [formGroup]="editForm" (ngSubmit)="saveEdit(cat.id)">
                  <!-- Name row -->
                  <div class="flex gap-2 mb-3">
                    <input
                      type="text"
                      formControlName="name"
                      class="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-sm"
                      placeholder="Category name"
                    />
                    <!-- Amount: hidden for unbudgeted; auto-total when subcategories exist; editable otherwise -->
                    @if (!cat.isUnbudgeted) {
                      @if (cat.subcategories && cat.subcategories.length > 0) {
                        <div class="w-28 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm text-gray-500 flex items-center" title="Auto-calculated from subcategories">
                          {{ cat.allocatedAmount | currencyEur }}
                        </div>
                      } @else {
                        <input
                          type="number"
                          formControlName="allocatedAmount"
                          class="w-28 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-sm"
                          placeholder="Amount"
                          step="0.01"
                        />
                      }
                    } @else {
                      <div class="px-3 py-2 rounded-lg border border-orange-100 bg-orange-50 text-sm text-orange-500 flex items-center whitespace-nowrap">
                        Unbudgeted
                      </div>
                    }
                  </div>
                  <!-- Color picker -->
                  <div class="flex gap-2 mb-3 flex-wrap">
                    @for (c of presetColors; track c) {
                      <button type="button" (click)="editForm.patchValue({ color: c })"
                        class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                        [style.background-color]="c"
                        [class]="editForm.value.color === c ? 'border-gray-800 scale-110' : 'border-white shadow'">
                      </button>
                    }
                  </div>
                  <!-- Active months toggle -->
                  <div class="mb-3">
                    <label class="block text-xs font-medium text-gray-500 mb-1.5">Active months</label>
                    <div class="grid grid-cols-4 gap-1.5">
                      @for (m of months; track m.num) {
                        <button type="button" (click)="toggleMonth(m.num, 'edit')"
                          class="py-1.5 rounded-lg text-xs font-semibold transition-all"
                          [style]="editFormActiveMonths().includes(m.num)
                            ? 'background-color:' + editForm.value.color + ';color:#fff'
                            : ''"
                          [class]="editFormActiveMonths().includes(m.num)
                            ? ''
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'">
                          {{ m.label }}
                        </button>
                      }
                    </div>
                    <p class="text-xs text-gray-400 mt-1.5">{{ formatActiveMonths(editFormActiveMonths()) }}</p>
                  </div>

                  <!-- ── Subcategories section (budgeted categories only) ──── -->
                  @if (!cat.isUnbudgeted) {
                  <div class="mb-3 border-t border-gray-100 pt-3">
                    <p class="text-xs font-medium text-gray-500 mb-2">Subcategories
                      <span class="text-gray-400 font-normal ml-1">(optional — auto-calculates budget total)</span>
                    </p>

                    <!-- Existing subcategories list -->
                    @for (sub of cat.subcategories; track sub.id) {
                      @if (editingSubId() === sub.id) {
                        <!-- Inline edit row for this subcategory -->
                        <div class="flex gap-2 mb-1.5 items-center">
                          <input type="text" [formControl]="editSubForm.controls.name"
                            class="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-xs"
                            placeholder="Name" />
                          <input type="number" [formControl]="editSubForm.controls.amount"
                            class="w-20 px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-xs"
                            placeholder="0.00" step="0.01" />
                          <button type="button" (click)="saveEditSub(cat.id, sub.id)"
                            [disabled]="editSubForm.invalid"
                            class="p-1.5 rounded-lg bg-[var(--color-brand-500)] text-white disabled:opacity-50">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </button>
                          <button type="button" (click)="editingSubId.set(null)"
                            class="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      } @else {
                        <!-- Subcategory list item -->
                        <div class="flex items-center gap-2 py-1.5 group">
                          <span class="flex-1 text-xs text-gray-700 truncate">{{ sub.name }}</span>
                          <span class="text-xs font-medium text-gray-500">{{ sub.amount | currencyEur }}</span>
                          <button type="button" (click)="startEditSub(sub)"
                            class="p-1 rounded text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                          </button>
                          <button type="button" (click)="deleteSub(cat.id, sub.id)"
                            class="p-1 rounded text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      }
                    }

                    <!-- Add subcategory inline form -->
                    @if (showAddSub() && editingId() === cat.id) {
                      <div class="flex gap-2 mt-1.5 items-center">
                        <input type="text" [formControl]="addSubForm.controls.name"
                          class="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-xs"
                          placeholder="Name e.g. Netflix" />
                        <input type="number" [formControl]="addSubForm.controls.amount"
                          class="w-20 px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-xs"
                          placeholder="9.99" step="0.01" />
                        <button type="button" (click)="addSubcategory(cat.id)"
                          [disabled]="addSubForm.invalid || isSavingSubcategory()"
                          class="p-1.5 rounded-lg bg-[var(--color-brand-500)] text-white disabled:opacity-50">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                        <button type="button" (click)="showAddSub.set(false)"
                          class="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    } @else {
                      <button type="button" (click)="showAddSub.set(true)"
                        class="mt-1.5 text-xs text-[var(--color-brand-500)] hover:underline flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add subcategory
                      </button>
                    }

                    @if (cat.subcategories && cat.subcategories.length > 0) {
                      <p class="text-xs text-gray-400 mt-2">Budget total auto-calculated: {{ cat.allocatedAmount | currencyEur }}</p>
                    }
                  </div>
                  <!-- ── end subcategories ─────────────────────────── -->
                  } <!-- end @if (!cat.isUnbudgeted) -->

                  <div class="flex gap-2">
                    <button type="submit" [disabled]="editForm.invalid"
                      class="flex-1 py-2 bg-[var(--color-brand-500)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-brand-600)] disabled:opacity-50 transition-colors">
                      Save
                    </button>
                    <button type="button" (click)="cancelEdit()"
                      class="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              } @else {
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    [style.background-color]="cat.color + '20'">
                    <svg class="w-5 h-5" [style.color]="cat.color" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="getIconPath(cat.icon)" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="font-semibold text-gray-900 truncate">{{ cat.name }}</p>
                      @if (cat.isUnbudgeted) {
                        <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-500 flex-shrink-0">Unbudgeted</span>
                      }
                    </div>
                    @if (!cat.isUnbudgeted) {
                      <p class="text-sm text-gray-500">{{ cat.allocatedAmount | currencyEur }} / month</p>
                    } @else {
                      <p class="text-sm text-gray-400">Tracks spending only</p>
                    }
                    @if (cat.activeMonths && cat.activeMonths.length > 0) {
                      <p class="text-xs text-gray-400">{{ formatActiveMonths(cat.activeMonths) }}</p>
                    }
                    @if (cat.subcategories && cat.subcategories.length > 0) {
                      <p class="text-xs text-gray-400">{{ cat.subcategories.length }} subcategories</p>
                    }
                  </div>
                  <div class="flex gap-1">
                    <button (click)="startEdit(cat)"
                      class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button (click)="deleteCategory(cat.id)"
                      class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          @if (!state.hasCategories()) {
            <div class="text-center py-8 text-gray-400">
              <p class="text-sm">No budget categories yet. Add your first one below.</p>
            </div>
          }

          <!-- Add category form -->
          @if (showAddForm()) {
            <div class="bg-white rounded-2xl p-4 shadow-sm border-2 border-[var(--color-brand-500)] mb-3">
              <h3 class="font-semibold text-gray-900 mb-3 text-sm">New Category</h3>
              <form [formGroup]="addForm" (ngSubmit)="addCategory()">
                <div class="flex gap-2 mb-3">
                  <input
                    type="text"
                    formControlName="name"
                    class="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-sm"
                    placeholder="e.g. Groceries"
                  />
                  @if (!addFormIsUnbudgeted()) {
                    <input
                      type="number"
                      formControlName="allocatedAmount"
                      class="w-28 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] text-sm"
                      placeholder="500"
                      step="0.01"
                    />
                  } @else {
                    <div class="px-3 py-2 rounded-lg border border-orange-100 bg-orange-50 text-sm text-orange-500 flex items-center whitespace-nowrap">
                      Unbudgeted
                    </div>
                  }
                </div>
                <!-- Unbudgeted toggle -->
                <button type="button" (click)="toggleAddFormUnbudgeted()"
                  class="flex items-center gap-2 mb-3 text-sm transition-colors"
                  [class]="addFormIsUnbudgeted() ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'">
                  <div class="w-8 h-4 rounded-full transition-colors flex items-center px-0.5"
                    [class]="addFormIsUnbudgeted() ? 'bg-orange-400' : 'bg-gray-200'">
                    <div class="w-3 h-3 bg-white rounded-full shadow transition-transform"
                      [class]="addFormIsUnbudgeted() ? 'translate-x-4' : 'translate-x-0'"></div>
                  </div>
                  No budget limit (tracking only)
                </button>
                <!-- Color picker -->
                <div class="flex gap-2 mb-3 flex-wrap">
                  @for (c of presetColors; track c) {
                    <button type="button" (click)="addForm.patchValue({ color: c })"
                      class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      [style.background-color]="c"
                      [class]="addForm.value.color === c ? 'border-gray-800 scale-110' : 'border-white shadow'">
                    </button>
                  }
                </div>
                <!-- Icon picker -->
                <div class="flex gap-2 mb-3 flex-wrap">
                  @for (icon of presetIcons; track icon.id) {
                    <button type="button" (click)="addForm.patchValue({ icon: icon.id })"
                      class="p-2 rounded-lg border-2 transition-all hover:bg-gray-50"
                      [class]="addForm.value.icon === icon.id
                        ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)]'
                        : 'border-gray-200'"
                      [title]="icon.label">
                      <svg class="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="icon.svg" />
                      </svg>
                    </button>
                  }
                </div>
                <!-- Active months toggle -->
                <div class="mb-3">
                  <label class="block text-xs font-medium text-gray-500 mb-1.5">Active months</label>
                  <div class="grid grid-cols-4 gap-1.5">
                    @for (m of months; track m.num) {
                      <button type="button" (click)="toggleMonth(m.num, 'add')"
                        class="py-1.5 rounded-lg text-xs font-semibold transition-all"
                        [style]="addFormActiveMonths().includes(m.num)
                          ? 'background-color:' + addForm.value.color + ';color:#fff'
                          : ''"
                        [class]="addFormActiveMonths().includes(m.num)
                          ? ''
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'">
                        {{ m.label }}
                      </button>
                    }
                  </div>
                  <p class="text-xs text-gray-400 mt-1.5">{{ formatActiveMonths(addFormActiveMonths()) }}</p>
                </div>
                <p class="text-xs text-gray-400 mb-3">
                  💡 Subcategories can be added after saving the category.
                </p>
                <div class="flex gap-2">
                  <button type="submit" [disabled]="addForm.invalid || isSavingCategory()"
                    class="flex-1 py-2 bg-[var(--color-brand-500)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-brand-600)] disabled:opacity-50 transition-colors">
                    {{ isSavingCategory() ? 'Adding...' : 'Add Category' }}
                  </button>
                  <button type="button" (click)="cancelAdd()"
                    class="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          }

          <button
            (click)="showAddForm.set(true)"
            class="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-500)] transition-colors flex items-center justify-center gap-2 font-medium text-sm"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Category
          </button>
        </div>
      }
    </div>
  `,
})
export class SetupComponent implements OnInit {
  readonly state = inject(BudgetStateService);
  private readonly incomeService = inject(IncomeService);
  private readonly categoryService = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  readonly activeTab = signal<'income' | 'categories'>('categories');
  readonly showAddForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly isSavingIncome = signal(false);
  readonly isSavingCategory = signal(false);

  // Subcategory signals
  readonly showAddSub = signal(false);
  readonly editingSubId = signal<string | null>(null);
  readonly isSavingSubcategory = signal(false);

  readonly presetColors = PRESET_COLORS;
  readonly presetIcons = PRESET_ICONS;
  readonly months = MONTHS;

  /** Tracks selected months for the add form (separate from FormGroup) */
  readonly addFormActiveMonths = signal<number[]>([]);
  /** Tracks selected months for the edit form (separate from FormGroup) */
  readonly editFormActiveMonths = signal<number[]>([]);
  /** Whether the new category being added has no budget limit */
  readonly addFormIsUnbudgeted = signal(false);

  readonly incomeForm = this.fb.group({
    monthlyAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    incomeDay: [null as number | null, [Validators.required, Validators.min(1), Validators.max(31)]],
  });

  readonly addForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    allocatedAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    color: [PRESET_COLORS[0]],
    icon: ['tag'],
  });

  readonly editForm = this.fb.group({
    name: ['', [Validators.required]],
    allocatedAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    color: [''],
  });

  // Subcategory forms
  readonly addSubForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  readonly editSubForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  budgetCoveragePercent(): number {
    const income = this.state.incomeConfig();
    if (!income) return 0;
    return (this.state.totalAllocated() / parseFloat(income.monthlyAmount)) * 100;
  }

  ngOnInit() {
    const config = this.state.incomeConfig();
    if (config) {
      this.incomeForm.patchValue({
        monthlyAmount: parseFloat(config.monthlyAmount),
        incomeDay: config.incomeDay,
      });
    }
  }

  saveIncome() {
    if (this.incomeForm.invalid) return;
    const { monthlyAmount, incomeDay } = this.incomeForm.value;
    this.isSavingIncome.set(true);
    this.incomeService.upsertIncomeConfig(monthlyAmount!, incomeDay!).subscribe({
      next: () => {
        this.isSavingIncome.set(false);
        this.activeTab.set('categories');
      },
      error: () => this.isSavingIncome.set(false),
    });
  }

  /** Toggle a month in either the add or edit form's activeMonths list */
  toggleMonth(month: number, form: 'add' | 'edit') {
    const sig = form === 'add' ? this.addFormActiveMonths : this.editFormActiveMonths;
    const current = sig();
    if (current.includes(month)) {
      sig.set(current.filter((m) => m !== month));
    } else {
      sig.set([...current, month].sort((a, b) => a - b));
    }
  }

  /** Returns "Every month" when months is empty, otherwise abbreviated names like "Apr, Jul, Oct, Dec" */
  formatActiveMonths(months: number[]): string {
    if (!months || months.length === 0) return 'Every month';
    return months.map((m) => MONTHS[m - 1]?.label ?? m).join(', ');
  }

  toggleAddFormUnbudgeted() {
    const isUnbudgeted = !this.addFormIsUnbudgeted();
    this.addFormIsUnbudgeted.set(isUnbudgeted);
    if (isUnbudgeted) {
      this.addForm.controls.allocatedAmount.clearValidators();
      this.addForm.controls.allocatedAmount.setValue(null);
    } else {
      this.addForm.controls.allocatedAmount.setValidators([Validators.required, Validators.min(0.01)]);
    }
    this.addForm.controls.allocatedAmount.updateValueAndValidity();
  }

  addCategory() {
    if (this.addForm.invalid) return;
    const v = this.addForm.value;
    const isUnbudgeted = this.addFormIsUnbudgeted();
    const dto: CreateCategoryDto = {
      name: v.name!,
      ...(isUnbudgeted ? { isUnbudgeted: true } : { allocatedAmount: v.allocatedAmount! }),
      color: v.color || PRESET_COLORS[0],
      icon: v.icon || 'tag',
      sortOrder: this.state.categories().length,
      activeMonths: this.addFormActiveMonths(),
    };
    this.isSavingCategory.set(true);
    this.categoryService.createCategory(dto).subscribe({
      next: (createdCat) => {
        this.isSavingCategory.set(false);
        this.showAddForm.set(false);
        this.addForm.reset({ color: PRESET_COLORS[0], icon: 'tag' });
        this.addFormActiveMonths.set([]);
        this.addFormIsUnbudgeted.set(false);
        this.addForm.controls.allocatedAmount.setValidators([Validators.required, Validators.min(0.01)]);
        this.addForm.controls.allocatedAmount.updateValueAndValidity();
        // Immediately open the new category in edit mode so subcategories can be added right away
        this.startEdit(createdCat);
      },
      error: () => this.isSavingCategory.set(false),
    });
  }

  startEdit(cat: Category) {
    this.editingId.set(cat.id);
    this.showAddSub.set(false);
    this.editingSubId.set(null);
    this.addSubForm.reset();
    this.editForm.patchValue({ name: cat.name, color: cat.color });
    if (cat.isUnbudgeted) {
      // Unbudgeted categories have no amount field
      this.editForm.controls.allocatedAmount.clearValidators();
      this.editForm.controls.allocatedAmount.setValue(null);
    } else {
      const hasSubs = cat.subcategories && cat.subcategories.length > 0;
      this.editForm.patchValue({
        allocatedAmount: hasSubs ? (cat.allocatedAmount as unknown as number) : parseFloat(cat.allocatedAmount),
      });
      if (hasSubs) {
        this.editForm.controls.allocatedAmount.clearValidators();
      } else {
        this.editForm.controls.allocatedAmount.setValidators([Validators.required, Validators.min(0.01)]);
      }
    }
    this.editForm.controls.allocatedAmount.updateValueAndValidity();
    this.editFormActiveMonths.set(cat.activeMonths ? [...cat.activeMonths] : []);
  }

  saveEdit(id: string) {
    if (this.editForm.invalid) return;
    const v = this.editForm.value;
    const cat = this.state.categories().find((c) => c.id === id);
    const isUnbudgeted = cat?.isUnbudgeted ?? false;
    const hasSubs = !isUnbudgeted && cat?.subcategories && cat.subcategories.length > 0;
    const dto: Parameters<typeof this.categoryService.updateCategory>[1] = {
      name: v.name!,
      color: v.color!,
      activeMonths: this.editFormActiveMonths(),
      // Don't send allocatedAmount for unbudgeted or categories with subcategories
      ...(isUnbudgeted || hasSubs ? {} : { allocatedAmount: v.allocatedAmount! }),
    };
    this.categoryService.updateCategory(id, dto).subscribe({
      next: () => this.cancelEdit(),
    });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.showAddSub.set(false);
    this.editingSubId.set(null);
    this.addSubForm.reset();
    this.editSubForm.reset();
  }

  cancelAdd() {
    this.showAddForm.set(false);
    this.addForm.reset({ color: PRESET_COLORS[0], icon: 'tag' });
    this.addFormActiveMonths.set([]);
    this.addFormIsUnbudgeted.set(false);
    this.addForm.controls.allocatedAmount.setValidators([Validators.required, Validators.min(0.01)]);
    this.addForm.controls.allocatedAmount.updateValueAndValidity();
  }

  deleteCategory(id: string) {
    if (!confirm('Remove this category?')) return;
    this.categoryService.deleteCategory(id).subscribe();
  }

  // ─── Subcategory methods ────────────────────────────────────────────────────

  addSubcategory(categoryId: string) {
    if (this.addSubForm.invalid) return;
    const v = this.addSubForm.value;
    this.isSavingSubcategory.set(true);
    this.categoryService.createSubcategory(categoryId, { name: v.name!, amount: v.amount! }).subscribe({
      next: () => {
        this.isSavingSubcategory.set(false);
        this.showAddSub.set(false);
        this.addSubForm.reset();
        // Refresh edit form to reflect new allocatedAmount
        const updated = this.state.categories().find((c) => c.id === categoryId);
        if (updated) this.refreshEditFormAfterSubChange(updated);
      },
      error: () => this.isSavingSubcategory.set(false),
    });
  }

  startEditSub(sub: Subcategory) {
    this.editingSubId.set(sub.id);
    this.showAddSub.set(false);
    this.editSubForm.patchValue({ name: sub.name, amount: parseFloat(sub.amount) });
  }

  saveEditSub(categoryId: string, subId: string) {
    if (this.editSubForm.invalid) return;
    const v = this.editSubForm.value;
    this.categoryService.updateSubcategory(categoryId, subId, { name: v.name!, amount: v.amount! }).subscribe({
      next: () => {
        this.editingSubId.set(null);
        this.editSubForm.reset();
        const updated = this.state.categories().find((c) => c.id === categoryId);
        if (updated) this.refreshEditFormAfterSubChange(updated);
      },
    });
  }

  deleteSub(categoryId: string, subId: string) {
    if (!confirm('Remove this subcategory?')) return;
    this.categoryService.deleteSubcategory(categoryId, subId).subscribe({
      next: () => {
        const updated = this.state.categories().find((c) => c.id === categoryId);
        if (updated) this.refreshEditFormAfterSubChange(updated);
      },
    });
  }

  /** After a subcategory change, re-sync edit form validators with new subs state */
  private refreshEditFormAfterSubChange(cat: Category) {
    const hasSubs = cat.subcategories && cat.subcategories.length > 0;
    if (hasSubs) {
      this.editForm.controls.allocatedAmount.clearValidators();
    } else {
      this.editForm.controls.allocatedAmount.setValidators([Validators.required, Validators.min(0.01)]);
      this.editForm.controls.allocatedAmount.patchValue(parseFloat(cat.allocatedAmount));
    }
    this.editForm.controls.allocatedAmount.updateValueAndValidity();
  }

  getIconPath(iconId: string): string {
    return PRESET_ICONS.find((i) => i.id === iconId)?.svg ?? PRESET_ICONS[PRESET_ICONS.length - 1].svg;
  }
}
