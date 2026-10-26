import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ReviewService } from '../../services/review.service';
import { BudgetStateService } from '../../services/budget-state.service';
import { CurrencyEurPipe } from '../../shared/pipes/currency-format.pipe';
import { ReviewDecisionResult, ReviewTransaction } from '../../core/models/review.model';
import { RuleField } from '../../core/models/rule.model';
import {
  RuleConditionComponent,
  RuleConditionForm,
  toRuleCondition,
} from '../../shared/components/rules/rule-condition.component';
import { apiErrorMessage } from '../../shared/utils/api-error';

@Component({
  selector: 'app-review',
  imports: [RouterLink, CurrencyEurPipe, RuleConditionComponent],
  template: `
    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Review</h1>
        <a routerLink="/rules" class="text-sm font-medium text-[var(--color-brand-600)] hover:underline">Rules</a>
      </div>

      @if (notice()) {
        <p class="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-xl">{{ notice() }}</p>
      }
      @if (error()) {
        <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="text-sm text-gray-400">Loading…</p>
      } @else if (transactions().length === 0) {
        <div class="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p class="font-semibold text-gray-900 mb-1">Nothing to review</p>
          <p class="text-sm text-gray-500">Imported transactions that could not be categorized automatically show up here.</p>
        </div>
      } @else {
        <p class="text-sm text-gray-500 mb-3">{{ transactions().length }} waiting for a category</p>
        <div class="space-y-3">
          @for (tx of transactions(); track tx.id) {
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
              <button type="button" (click)="toggle(tx)"
                class="w-full flex items-start justify-between gap-3 p-4 text-left">
                <div class="min-w-0">
                  <p class="font-medium text-gray-900 truncate">{{ tx.counterpartyName ?? tx.description ?? 'Unknown counterparty' }}</p>
                  <p class="text-xs text-gray-500 truncate">
                    {{ tx.transactionDate ?? tx.bookingDate }}
                    @if (tx.counterpartyName && tx.description) { · {{ tx.description }} }
                    @if (tx.variableSymbol) { · VS {{ tx.variableSymbol }} }
                  </p>
                  @if (tx.counterpartyIban) {
                    <p class="text-xs text-gray-400 font-mono truncate">{{ tx.counterpartyIban }}</p>
                  }
                </div>
                <span class="font-semibold text-gray-900 whitespace-nowrap">{{ tx.amount | currencyEur }}</span>
              </button>

              @if (openId() === tx.id) {
                <div class="border-t border-gray-100 p-4 space-y-3">
                  <div class="grid grid-cols-2 gap-2">
                    <select [value]="categoryId()" (change)="selectCategory($any($event.target).value)"
                      class="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]">
                      <option value="">Category…</option>
                      @for (cat of state.categories(); track cat.id) {
                        <option [value]="cat.id">{{ cat.name }}</option>
                      }
                    </select>
                    <select [value]="subcategoryId()" (change)="subcategoryId.set($any($event.target).value)"
                      [disabled]="subcategories().length === 0"
                      class="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]">
                      <option value="">{{ subcategories().length ? 'No subcategory' : 'No subcategories' }}</option>
                      @for (sub of subcategories(); track sub.id) {
                        <option [value]="sub.id">{{ sub.name }} ({{ sub.amount | currencyEur }})</option>
                      }
                    </select>
                  </div>

                  <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" [checked]="always()" (change)="always.set($any($event.target).checked)"
                      class="rounded border-gray-300" />
                    Always do this for transactions where…
                  </label>
                  @if (always()) {
                    <app-rule-condition [(condition)]="condition" />
                  }

                  <div class="flex gap-2">
                    <button type="button" (click)="categorize(tx)" [disabled]="!categoryId() || saving()"
                      class="flex-1 py-2.5 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:bg-[var(--color-brand-600)] disabled:opacity-50 transition-colors">
                      Save
                    </button>
                    <button type="button" (click)="ignore(tx)" [disabled]="saving()"
                      class="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      Ignore
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ReviewComponent implements OnInit {
  private readonly reviewService = inject(ReviewService);
  readonly state = inject(BudgetStateService);

  readonly transactions = signal<ReviewTransaction[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly openId = signal<string | null>(null);
  readonly categoryId = signal('');
  readonly subcategoryId = signal('');
  readonly always = signal(false);
  readonly condition = signal<RuleConditionForm>(conditionFor(null));

  readonly subcategories = computed(
    () => this.state.categories().find((c) => c.id === this.categoryId())?.subcategories ?? [],
  );

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.reviewService.pending().subscribe({
      next: (txs) => {
        this.transactions.set(txs);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err, 'Could not load transactions'));
        this.loading.set(false);
      },
    });
  }

  toggle(tx: ReviewTransaction) {
    if (this.openId() === tx.id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(tx.id);
    this.categoryId.set('');
    this.subcategoryId.set('');
    this.always.set(false);
    this.condition.set(conditionFor(tx));
  }

  selectCategory(id: string) {
    this.categoryId.set(id);
    this.subcategoryId.set('');
  }

  categorize(tx: ReviewTransaction) {
    this.submit(
      tx,
      this.reviewService.categorize(tx.id, {
        categoryId: this.categoryId(),
        subcategoryId: this.subcategoryId() || undefined,
        rule: this.always() ? toRuleCondition(this.condition()) : undefined,
      }),
    );
  }

  ignore(tx: ReviewTransaction) {
    this.submit(
      tx,
      this.reviewService.ignore(tx.id, this.always() ? toRuleCondition(this.condition()) : undefined),
    );
  }

  private submit(tx: ReviewTransaction, request: ReturnType<ReviewService['ignore']>) {
    this.saving.set(true);
    this.error.set(null);
    this.notice.set(null);
    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.openId.set(null);
        if (result.ruleId) {
          this.notice.set(ruleNotice(result));
          this.load();
        } else {
          this.transactions.update((txs) => txs.filter((t) => t.id !== tx.id));
        }
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err, 'Could not save'));
        this.saving.set(false);
      },
    });
  }
}

function conditionFor(tx: ReviewTransaction | null): RuleConditionForm {
  const [field, pattern]: [RuleField, string] = tx?.counterpartyIban
    ? ['COUNTERPARTY_IBAN', tx.counterpartyIban]
    : tx?.counterpartyName
      ? ['COUNTERPARTY_NAME', tx.counterpartyName]
      : ['DESCRIPTION', tx?.description ?? ''];
  return {
    field,
    matchType: field === 'COUNTERPARTY_IBAN' ? 'EQUALS' : 'CONTAINS',
    pattern,
    amountMin: '',
    amountMax: '',
  };
}

function ruleNotice(result: ReviewDecisionResult): string {
  const others = result.alsoCategorized + result.alsoIgnored;
  if (others === 0) return 'Rule saved.';
  return `Rule saved and applied to ${others} more transaction${others === 1 ? '' : 's'}.`;
}
