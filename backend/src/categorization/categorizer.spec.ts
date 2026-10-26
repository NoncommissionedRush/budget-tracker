import {
  BillSpec,
  HistoryEntry,
  RuleSpec,
  TransactionFacts,
  createCategorizer,
  ruleMatches,
} from './categorizer';

const tx = (overrides: Partial<TransactionFacts> = {}): TransactionFacts => ({
  counterpartyIban: 'SK0099000000000000000102',
  counterpartyName: 'Example Insurance',
  description: 'Okamzita platba',
  variableSymbol: '5555000011',
  amount: '54.50',
  ...overrides,
});

const rule = (overrides: Partial<RuleSpec> = {}): RuleSpec => ({
  id: 'rule',
  field: 'COUNTERPARTY_NAME',
  matchType: 'CONTAINS',
  pattern: 'insurance',
  amountMin: null,
  amountMax: null,
  action: 'CATEGORIZE',
  categoryId: 'cat-rule',
  subcategoryId: null,
  ...overrides,
});

const past = (
  categoryId: string,
  subcategoryId: string | null = null,
  overrides: Partial<HistoryEntry> = {},
): HistoryEntry => ({
  counterpartyIban: 'SK0099000000000000000102',
  counterpartyName: 'Example Insurance',
  categoryId,
  subcategoryId,
  ...overrides,
});

const bill = (overrides: Partial<BillSpec> = {}): BillSpec => ({
  id: 'sub-insurance',
  categoryId: 'cat-bills',
  name: 'Insurance',
  amount: '54.50',
  ...overrides,
});

describe('ruleMatches', () => {
  it('matches a name case- and accent-insensitively', () => {
    expect(
      ruleMatches(
        rule({ pattern: 'potraviny' }),
        tx({ counterpartyName: 'POTRAVINY Žilina' }),
      ),
    ).toBe(true);
    expect(
      ruleMatches(
        rule({ pattern: 'Žilina' }),
        tx({ counterpartyName: 'potraviny zilina' }),
      ),
    ).toBe(true);
  });

  it('requires the whole value for EQUALS', () => {
    const r = rule({ matchType: 'EQUALS', pattern: 'example' });
    expect(ruleMatches(r, tx())).toBe(false);
    expect(ruleMatches(r, tx({ counterpartyName: ' Example ' }))).toBe(true);
  });

  it('compares IBANs without spaces', () => {
    const r = rule({
      field: 'COUNTERPARTY_IBAN',
      matchType: 'EQUALS',
      pattern: 'sk00 9900 0000 0000 0000 0102',
    });
    expect(ruleMatches(r, tx())).toBe(true);
    expect(
      ruleMatches(r, tx({ counterpartyIban: 'SK0099000000000000000103' })),
    ).toBe(false);
  });

  it('ignores leading zeros in variable symbols', () => {
    const r = rule({
      field: 'VARIABLE_SYMBOL',
      matchType: 'EQUALS',
      pattern: '00123',
    });
    expect(ruleMatches(r, tx({ variableSymbol: '123' }))).toBe(true);
    expect(ruleMatches(r, tx({ variableSymbol: '1230' }))).toBe(false);
  });

  it('matches description text', () => {
    const r = rule({ field: 'DESCRIPTION', pattern: 'platba' });
    expect(ruleMatches(r, tx())).toBe(true);
    expect(ruleMatches(r, tx({ description: null }))).toBe(false);
  });

  it('applies an inclusive amount range on top of the pattern', () => {
    const r = rule({ amountMin: '50.00', amountMax: '54.50' });
    expect(ruleMatches(r, tx({ amount: '54.50' }))).toBe(true);
    expect(ruleMatches(r, tx({ amount: '50.00' }))).toBe(true);
    expect(ruleMatches(r, tx({ amount: '54.51' }))).toBe(false);
    expect(ruleMatches(r, tx({ amount: '49.99' }))).toBe(false);
  });

  it('can match on amount alone', () => {
    const r = rule({ field: null, pattern: null, amountMax: '1.00' });
    expect(ruleMatches(r, tx({ amount: '0.99' }))).toBe(true);
    expect(ruleMatches(r, tx({ amount: '1.01' }))).toBe(false);
  });

  it('never matches a rule without conditions or a field without a value', () => {
    expect(ruleMatches(rule({ field: null, pattern: null }), tx())).toBe(false);
    expect(ruleMatches(rule({ pattern: '' }), tx())).toBe(false);
    expect(ruleMatches(rule(), tx({ counterpartyName: null }))).toBe(false);
  });
});

describe('createCategorizer', () => {
  const empty = { rules: [], history: [], bills: [] };

  it('uses the first matching rule in priority order', () => {
    const decide = createCategorizer({
      ...empty,
      rules: [
        rule({ id: 'r1', pattern: 'nomatch', categoryId: 'cat-1' }),
        rule({ id: 'r2', pattern: 'example', categoryId: 'cat-2' }),
        rule({ id: 'r3', pattern: 'insurance', categoryId: 'cat-3' }),
      ],
    });
    expect(decide(tx())).toEqual({
      method: 'RULE',
      ruleId: 'r2',
      action: 'CATEGORIZE',
      target: { categoryId: 'cat-2', subcategoryId: null },
    });
  });

  it('lets an ignore rule win over a later categorize rule', () => {
    const decide = createCategorizer({
      ...empty,
      rules: [
        rule({ id: 'skip', action: 'IGNORE', categoryId: null }),
        rule({ id: 'cat' }),
      ],
    });
    expect(decide(tx())).toEqual({
      method: 'RULE',
      ruleId: 'skip',
      action: 'IGNORE',
    });
  });

  it('prefers rules over history and bills', () => {
    const decide = createCategorizer({
      rules: [rule({ categoryId: 'cat-rule', subcategoryId: 'sub-rule' })],
      history: [past('cat-history')],
      bills: [bill()],
    });
    expect(decide(tx())).toMatchObject({
      method: 'RULE',
      target: { categoryId: 'cat-rule', subcategoryId: 'sub-rule' },
    });
  });

  it('falls back to history when no rule matches', () => {
    const decide = createCategorizer({
      rules: [rule({ pattern: 'nomatch' })],
      history: [past('cat-history'), past('cat-history')],
      bills: [bill()],
    });
    expect(decide(tx())).toEqual({
      method: 'HISTORY',
      target: { categoryId: 'cat-history', subcategoryId: null },
    });
  });

  it('recognises a counterparty by name when it has no IBAN', () => {
    const decide = createCategorizer({
      ...empty,
      history: [
        past('cat-coffee', null, {
          counterpartyIban: null,
          counterpartyName: 'COFFEE SHOP-BRATISLAVA',
        }),
      ],
    });
    expect(
      decide(
        tx({
          counterpartyIban: null,
          counterpartyName: 'Coffee Shop-Bratislava',
        }),
      ),
    ).toMatchObject({
      method: 'HISTORY',
      target: { categoryId: 'cat-coffee' },
    });
  });

  it('does not trust history when recent categorizations disagree', () => {
    const decide = createCategorizer({
      ...empty,
      history: [past('cat-a'), past('cat-b')],
    });
    expect(decide(tx())).toBeNull();
  });

  it('only looks at the most recent history', () => {
    const decide = createCategorizer({
      ...empty,
      history: [...Array(5).fill(past('cat-new')), past('cat-old')],
    });
    expect(decide(tx())).toMatchObject({
      method: 'HISTORY',
      target: { categoryId: 'cat-new' },
    });
  });

  it('matches a bill by amount when history is split between bills', () => {
    const decide = createCategorizer({
      ...empty,
      history: [past('cat-bills', 'sub-car'), past('cat-bills', 'sub-home')],
      bills: [
        bill({ id: 'sub-car', name: 'Car', amount: '30.00' }),
        bill({ id: 'sub-home', name: 'Home', amount: '54.50' }),
      ],
    });
    expect(decide(tx())).toEqual({
      method: 'BILL',
      target: { categoryId: 'cat-bills', subcategoryId: 'sub-home' },
    });
  });

  it('matches a bill by name and amount for a new counterparty', () => {
    const decide = createCategorizer({
      ...empty,
      bills: [bill(), bill({ id: 'sub-rent', name: 'Rent', amount: '54.50' })],
    });
    expect(decide(tx())).toEqual({
      method: 'BILL',
      target: { categoryId: 'cat-bills', subcategoryId: 'sub-insurance' },
    });
  });

  it('does not match a bill when the amount differs', () => {
    const decide = createCategorizer({ ...empty, bills: [bill()] });
    expect(decide(tx({ amount: '54.00' }))).toBeNull();
  });

  it('does not guess between several bills that fit', () => {
    const decide = createCategorizer({
      ...empty,
      bills: [
        bill({ id: 'a', name: 'Insurance' }),
        bill({ id: 'b', name: 'Example' }),
      ],
    });
    expect(decide(tx())).toBeNull();
  });

  it('sends everything else to review', () => {
    expect(createCategorizer(empty)(tx())).toBeNull();
  });
});
