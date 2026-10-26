export type RuleField = 'COUNTERPARTY_IBAN' | 'COUNTERPARTY_NAME' | 'DESCRIPTION' | 'VARIABLE_SYMBOL';
export type RuleMatchType = 'EQUALS' | 'CONTAINS';
export type RuleAction = 'CATEGORIZE' | 'IGNORE';

export const RULE_FIELD_LABELS: Record<RuleField, string> = {
  COUNTERPARTY_IBAN: 'Counterparty IBAN',
  COUNTERPARTY_NAME: 'Counterparty name',
  DESCRIPTION: 'Description',
  VARIABLE_SYMBOL: 'Variable symbol',
};

export const RULE_FIELDS = Object.keys(RULE_FIELD_LABELS) as RuleField[];

export interface RuleCondition {
  field?: RuleField | null;
  matchType?: RuleMatchType;
  pattern?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
}

export interface RuleInput extends RuleCondition {
  action?: RuleAction;
  categoryId?: string | null;
  subcategoryId?: string | null;
}

export interface RuleTargetRef {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CategorizationRule {
  id: string;
  field: RuleField | null;
  matchType: RuleMatchType;
  pattern: string | null;
  amountMin: string | null;
  amountMax: string | null;
  action: RuleAction;
  categoryId: string | null;
  subcategoryId: string | null;
  priority: number;
  category: RuleTargetRef | null;
  subcategory: RuleTargetRef | null;
}

export interface ApplyRulesResult {
  categorized: number;
  ignored: number;
  remaining: number;
}
