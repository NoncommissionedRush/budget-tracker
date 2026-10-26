import Decimal from 'decimal.js';

export type RuleField =
  | 'COUNTERPARTY_IBAN'
  | 'COUNTERPARTY_NAME'
  | 'DESCRIPTION'
  | 'VARIABLE_SYMBOL';

export interface TransactionFacts {
  counterpartyIban: string | null;
  counterpartyName: string | null;
  description: string | null;
  variableSymbol: string | null;
  amount: string;
}

export interface Target {
  categoryId: string;
  subcategoryId: string | null;
}

export interface RuleSpec {
  id: string;
  field: RuleField | null;
  matchType: 'EQUALS' | 'CONTAINS';
  pattern: string | null;
  amountMin: string | null;
  amountMax: string | null;
  action: 'CATEGORIZE' | 'IGNORE';
  categoryId: string | null;
  subcategoryId: string | null;
}

export interface HistoryEntry extends Target {
  counterpartyIban: string | null;
  counterpartyName: string | null;
}

export interface BillSpec {
  id: string;
  categoryId: string;
  name: string;
  amount: string;
}

export type Decision =
  | { method: 'RULE'; ruleId: string; action: 'IGNORE' }
  | { method: 'RULE'; ruleId: string; action: 'CATEGORIZE'; target: Target }
  | { method: 'HISTORY'; target: Target }
  | { method: 'BILL'; target: Target };

export interface CategorizerContext {
  /** Already sorted: the first matching rule wins. */
  rules: RuleSpec[];
  /** Newest first. */
  history: HistoryEntry[];
  bills: BillSpec[];
}

/** How many of a counterparty's most recent categorizations must agree before history is trusted. */
export const HISTORY_WINDOW = 5;

export function createCategorizer(ctx: CategorizerContext) {
  const history = new Map<string, HistoryEntry[]>();
  for (const entry of ctx.history) {
    const key = counterpartyKey(entry);
    if (!key) continue;
    const list = history.get(key) ?? [];
    list.push(entry);
    history.set(key, list);
  }

  return (tx: TransactionFacts): Decision | null => {
    const rule = ctx.rules.find((r) => ruleMatches(r, tx));
    if (rule) {
      if (rule.action === 'IGNORE')
        return { method: 'RULE', ruleId: rule.id, action: 'IGNORE' };
      if (rule.categoryId)
        return {
          method: 'RULE',
          ruleId: rule.id,
          action: 'CATEGORIZE',
          target: {
            categoryId: rule.categoryId,
            subcategoryId: rule.subcategoryId,
          },
        };
    }

    const key = counterpartyKey(tx);
    const past = key ? (history.get(key) ?? []) : [];

    const consensus = agreedTarget(past.slice(0, HISTORY_WINDOW));
    if (consensus) return { method: 'HISTORY', target: consensus };

    const bill = matchBill(tx, past, ctx.bills);
    if (bill)
      return {
        method: 'BILL',
        target: { categoryId: bill.categoryId, subcategoryId: bill.id },
      };

    return null;
  };
}

export function ruleMatches(rule: RuleSpec, tx: TransactionFacts): boolean {
  if (!rule.field && rule.amountMin === null && rule.amountMax === null)
    return false;

  const amount = new Decimal(tx.amount);
  if (rule.amountMin !== null && amount.lessThan(rule.amountMin)) return false;
  if (rule.amountMax !== null && amount.greaterThan(rule.amountMax))
    return false;

  if (!rule.field) return true;
  if (!rule.pattern) return false;
  const value = fieldValue(rule.field, tx);
  if (value === null) return false;

  const normalize = FIELD_NORMALIZERS[rule.field];
  const haystack = normalize(value);
  const needle = normalize(rule.pattern);
  if (!needle) return false;
  return rule.matchType === 'EQUALS'
    ? haystack === needle
    : haystack.includes(needle);
}

function fieldValue(field: RuleField, tx: TransactionFacts): string | null {
  switch (field) {
    case 'COUNTERPARTY_IBAN':
      return tx.counterpartyIban;
    case 'COUNTERPARTY_NAME':
      return tx.counterpartyName;
    case 'DESCRIPTION':
      return tx.description;
    case 'VARIABLE_SYMBOL':
      return tx.variableSymbol;
  }
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

// Banks pad variable symbols with leading zeros inconsistently.
export function normalizeSymbol(value: string): string {
  return value.replace(/\s+/g, '').replace(/^0+(?=.)/, '');
}

const FIELD_NORMALIZERS: Record<RuleField, (v: string) => string> = {
  COUNTERPARTY_IBAN: normalizeIban,
  COUNTERPARTY_NAME: normalizeText,
  DESCRIPTION: normalizeText,
  VARIABLE_SYMBOL: normalizeSymbol,
};

export function counterpartyKey(tx: {
  counterpartyIban: string | null;
  counterpartyName: string | null;
}): string | null {
  if (tx.counterpartyIban) return `iban:${normalizeIban(tx.counterpartyIban)}`;
  if (tx.counterpartyName) return `name:${normalizeText(tx.counterpartyName)}`;
  return null;
}

function agreedTarget(entries: Target[]): Target | null {
  if (entries.length === 0) return null;
  const [first] = entries;
  return entries.every((e) => sameTarget(e, first))
    ? { categoryId: first.categoryId, subcategoryId: first.subcategoryId }
    : null;
}

function sameTarget(a: Target, b: Target): boolean {
  return a.categoryId === b.categoryId && a.subcategoryId === b.subcategoryId;
}

/**
 * A bill is a subcategory with a fixed amount. A payment matches it when the amount is
 * exactly the bill amount and the counterparty is tied to that bill — either it paid the
 * bill before, or its name contains the bill's name. Only an unambiguous match counts.
 */
function matchBill(
  tx: TransactionFacts,
  past: HistoryEntry[],
  bills: BillSpec[],
): BillSpec | null {
  const amount = new Decimal(tx.amount);
  const sameAmount = bills.filter((b) => amount.equals(b.amount));
  if (sameAmount.length === 0) return null;

  const paidBefore = new Set(past.map((e) => e.subcategoryId).filter(Boolean));
  const byHistory = sameAmount.filter((b) => paidBefore.has(b.id));
  if (byHistory.length === 1) return byHistory[0];
  if (byHistory.length > 1) return null;

  if (!tx.counterpartyName) return null;
  const name = normalizeText(tx.counterpartyName);
  const byName = sameAmount.filter((b) => {
    const billName = normalizeText(b.name);
    return billName.length >= 3 && name.includes(billName);
  });
  return byName.length === 1 ? byName[0] : null;
}
