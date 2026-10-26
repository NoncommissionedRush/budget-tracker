import { Component, model } from '@angular/core';
import {
  RULE_FIELDS,
  RULE_FIELD_LABELS,
  RuleCondition,
  RuleField,
  RuleMatchType,
} from '../../../core/models/rule.model';

export interface RuleConditionForm {
  field: RuleField | '';
  matchType: RuleMatchType;
  pattern: string;
  amountMin: string;
  amountMax: string;
}

export function emptyCondition(): RuleConditionForm {
  return { field: 'COUNTERPARTY_NAME', matchType: 'CONTAINS', pattern: '', amountMin: '', amountMax: '' };
}

export function toRuleCondition(form: RuleConditionForm): RuleCondition {
  const amount = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    field: form.field || null,
    matchType: form.matchType,
    pattern: form.field ? form.pattern.trim() : null,
    amountMin: amount(form.amountMin),
    amountMax: amount(form.amountMax),
  };
}

@Component({
  selector: 'app-rule-condition',
  template: `
    <div class="grid grid-cols-2 gap-2">
      <select
        [value]="condition().field"
        (change)="patch({ field: $any($event.target).value })"
        class="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]">
        @for (f of fields; track f) {
          <option [value]="f">{{ labels[f] }}</option>
        }
        <option value="">Amount only</option>
      </select>
      @if (condition().field) {
        <select
          [value]="condition().matchType"
          (change)="patch({ matchType: $any($event.target).value })"
          class="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]">
          <option value="CONTAINS">contains</option>
          <option value="EQUALS">is exactly</option>
        </select>
        <input
          type="text"
          placeholder="Pattern"
          [value]="condition().pattern"
          (input)="patch({ pattern: $any($event.target).value })"
          class="col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" />
      }
      <input
        type="number" step="0.01" min="0" placeholder="Min amount (optional)"
        [value]="condition().amountMin"
        (input)="patch({ amountMin: $any($event.target).value })"
        class="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" />
      <input
        type="number" step="0.01" min="0" placeholder="Max amount (optional)"
        [value]="condition().amountMax"
        (input)="patch({ amountMax: $any($event.target).value })"
        class="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]" />
    </div>
  `,
})
export class RuleConditionComponent {
  readonly condition = model.required<RuleConditionForm>();
  readonly fields = RULE_FIELDS;
  readonly labels = RULE_FIELD_LABELS;

  patch(change: Partial<RuleConditionForm>) {
    this.condition.update((c) => ({ ...c, ...change }));
  }
}
