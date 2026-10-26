import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Observable } from 'rxjs';
import { RuleService } from '../../services/rule.service';
import { BudgetStateService } from '../../services/budget-state.service';
import { CurrencyEurPipe } from '../../shared/pipes/currency-format.pipe';
import {
  CategorizationRule,
  RULE_FIELD_LABELS,
  RuleAction,
} from '../../core/models/rule.model';
import {
  RuleConditionComponent,
  RuleConditionForm,
  emptyCondition,
  toRuleCondition,
} from '../../shared/components/rules/rule-condition.component';
import { apiErrorMessage } from '../../shared/utils/api-error';

@Component({
  selector: 'app-rules',
  imports: [NgTemplateOutlet, CurrencyEurPipe, RuleConditionComponent],
  template: `
    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-2xl font-bold text-gray-900">Rules</h1>
        <div class="flex gap-2">
          <button type="button" (click)="apply()" [disabled]="busy()"
            class="px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Apply to inbox
          </button>
          <button type="button" (click)="startCreate()"
            class="px-3 py-2 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:bg-[var(--color-brand-600)]">
            New rule
          </button>
        </div>
      </div>
      <p class="text-sm text-gray-500 mb-6">
        Imported transactions are checked against these rules from top to bottom; the first match wins.
        Without a match, the app tries earlier categorizations of the same counterparty, then bills with the same amount.
      </p>

      @if (notice()) {
        <p class="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-xl">{{ notice() }}</p>
      }
      @if (error()) {
        <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{{ error() }}</p>
      }

      @if (editingId() === 'new') {
        <ng-container [ngTemplateOutlet]="form" />
      }

      @if (rules().length === 0 && editingId() !== 'new') {
        <div class="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p class="font-semibold text-gray-900 mb-1">No rules yet</p>
          <p class="text-sm text-gray-500">Create one here, or tick "Always do this" when reviewing a transaction.</p>
        </div>
      }

      <div class="space-y-3">
        @for (rule of rules(); track rule.id; let i = $index; let last = $last) {
          @if (editingId() === rule.id) {
            <ng-container [ngTemplateOutlet]="form" />
          } @else {
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div class="flex flex-col">
                <button type="button" (click)="move(i, -1)" [disabled]="i === 0 || busy()" aria-label="Move up"
                  class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button type="button" (click)="move(i, 1)" [disabled]="last || busy()" aria-label="Move down"
                  class="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-gray-900">{{ describe(rule) }}</p>
                <p class="text-xs mt-0.5" [class]="isBroken(rule) ? 'text-amber-600' : 'text-gray-500'">
                  → {{ targetLabel(rule) }}
                </p>
              </div>
              <button type="button" (click)="startEdit(rule)"
                class="text-sm font-medium text-[var(--color-brand-600)] hover:underline">Edit</button>
              <button type="button" (click)="remove(rule)" [disabled]="busy()"
                class="text-sm font-medium text-red-600 hover:underline disabled:opacity-50">Delete</button>
            </div>
          }
        }
      </div>

      <ng-template #form>
        <div class="bg-white rounded-2xl shadow-sm border-2 border-[var(--color-brand-500)] p-4 space-y-3 mb-3">
          <p class="text-sm font-medium text-gray-700">When a transaction's…</p>
          <app-rule-condition [(condition)]="condition" />

          <div class="flex gap-2">
            @for (a of actions; track a.value) {
              <button type="button" (click)="action.set(a.value)"
                class="flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all"
                [class]="action() === a.value
                  ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'">
                {{ a.label }}
              </button>
            }
          </div>

          @if (action() === 'CATEGORIZE') {
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
          }

          <div class="flex gap-2">
            <button type="button" (click)="save()" [disabled]="busy() || (action() === 'CATEGORIZE' && !categoryId())"
              class="flex-1 py-2.5 rounded-xl bg-[var(--color-brand-500)] text-white text-sm font-semibold hover:bg-[var(--color-brand-600)] disabled:opacity-50">
              Save rule
            </button>
            <button type="button" (click)="editingId.set(null)"
              class="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </ng-template>
    </div>
  `,
})
export class RulesComponent implements OnInit {
  private readonly ruleService = inject(RuleService);
  readonly state = inject(BudgetStateService);

  readonly actions: { value: RuleAction; label: string }[] = [
    { value: 'CATEGORIZE', label: 'Categorize' },
    { value: 'IGNORE', label: 'Ignore' },
  ];

  readonly rules = signal<CategorizationRule[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly editingId = signal<string | 'new' | null>(null);
  readonly condition = signal<RuleConditionForm>(emptyCondition());
  readonly action = signal<RuleAction>('CATEGORIZE');
  readonly categoryId = signal('');
  readonly subcategoryId = signal('');

  readonly subcategories = computed(
    () => this.state.categories().find((c) => c.id === this.categoryId())?.subcategories ?? [],
  );

  ngOnInit() {
    this.run(this.ruleService.list(), (rules) => this.rules.set(rules));
  }

  startCreate() {
    this.fillForm(null);
    this.editingId.set('new');
  }

  startEdit(rule: CategorizationRule) {
    this.fillForm(rule);
    this.editingId.set(rule.id);
  }

  selectCategory(id: string) {
    this.categoryId.set(id);
    this.subcategoryId.set('');
  }

  save() {
    const input = {
      ...toRuleCondition(this.condition()),
      action: this.action(),
      categoryId: this.action() === 'CATEGORIZE' ? this.categoryId() : null,
      subcategoryId: this.action() === 'CATEGORIZE' ? this.subcategoryId() || null : null,
    };
    const id = this.editingId();
    const request = id === 'new' || id === null
      ? this.ruleService.create(input)
      : this.ruleService.update(id, input);
    this.run(request, (saved) => {
      this.rules.update((rules) =>
        id === 'new' ? [...rules, saved] : rules.map((r) => (r.id === saved.id ? saved : r)),
      );
      this.editingId.set(null);
    });
  }

  remove(rule: CategorizationRule) {
    if (!confirm('Delete this rule?')) return;
    this.run(this.ruleService.delete(rule.id), () =>
      this.rules.update((rules) => rules.filter((r) => r.id !== rule.id)),
    );
  }

  move(index: number, delta: number) {
    const order = this.rules().map((r) => r.id);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    this.run(this.ruleService.reorder(order), (rules) => this.rules.set(rules));
  }

  apply() {
    this.run(this.ruleService.apply(), (result) => {
      const done = result.categorized + result.ignored;
      this.notice.set(
        `${done} transaction${done === 1 ? '' : 's'} sorted, ${result.remaining} still waiting for review.`,
      );
    });
  }

  describe(rule: CategorizationRule): string {
    const parts: string[] = [];
    if (rule.field) {
      const op = rule.matchType === 'EQUALS' ? 'is' : 'contains';
      parts.push(`${RULE_FIELD_LABELS[rule.field]} ${op} "${rule.pattern}"`);
    }
    if (rule.amountMin !== null && rule.amountMax !== null) {
      parts.push(`amount ${rule.amountMin}–${rule.amountMax} €`);
    } else if (rule.amountMin !== null) {
      parts.push(`amount ≥ ${rule.amountMin} €`);
    } else if (rule.amountMax !== null) {
      parts.push(`amount ≤ ${rule.amountMax} €`);
    }
    return parts.join(' and ');
  }

  targetLabel(rule: CategorizationRule): string {
    if (rule.action === 'IGNORE') return 'Ignore';
    if (this.isBroken(rule)) return `${rule.category?.name ?? 'Deleted category'} (inactive — rule is skipped)`;
    return rule.subcategory ? `${rule.category!.name} / ${rule.subcategory.name}` : rule.category!.name;
  }

  isBroken(rule: CategorizationRule): boolean {
    return (
      rule.action === 'CATEGORIZE' &&
      (!rule.category?.isActive || (rule.subcategory !== null && !rule.subcategory.isActive))
    );
  }

  private fillForm(rule: CategorizationRule | null) {
    this.condition.set(
      rule
        ? {
            field: rule.field ?? '',
            matchType: rule.matchType,
            pattern: rule.pattern ?? '',
            amountMin: rule.amountMin ?? '',
            amountMax: rule.amountMax ?? '',
          }
        : emptyCondition(),
    );
    this.action.set(rule?.action ?? 'CATEGORIZE');
    this.categoryId.set(rule?.categoryId ?? '');
    this.subcategoryId.set(rule?.subcategoryId ?? '');
    this.error.set(null);
    this.notice.set(null);
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void) {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => {
        onSuccess(value);
        this.busy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err, 'Request failed'));
        this.busy.set(false);
      },
    });
  }
}
