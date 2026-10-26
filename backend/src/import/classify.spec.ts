import { classify, parseIbanList } from './classify';
import { NormalizedTransaction } from './parsers';

const base: NormalizedTransaction = {
  bankTransactionId: 'x',
  accountIban: 'SK0099000000000000000001',
  bookingDate: '2026-10-25',
  valueDate: null,
  transactionDate: null,
  amount: '10.00',
  currency: 'EUR',
  direction: 'DEBIT',
  isReversal: false,
  counterpartyName: 'Shop',
  counterpartyIban: 'SK0099000000000000000101',
  variableSymbol: null,
  constantSymbol: null,
  specificSymbol: null,
  description: null,
  bankTxCode: null,
};

const own = {
  ibans: new Set(['SK0099000000000000000003']),
  ownerName: 'Jana Vzorová',
};

describe('classify', () => {
  it('sends ordinary debits to review', () => {
    expect(classify(base, own)).toEqual({
      status: 'NEEDS_REVIEW',
      ignoreReason: null,
    });
  });

  it('ignores credits', () => {
    expect(classify({ ...base, direction: 'CREDIT' }, own)).toEqual({
      status: 'IGNORED',
      ignoreReason: 'credit',
    });
  });

  it('ignores reversals', () => {
    expect(classify({ ...base, isReversal: true }, own).ignoreReason).toBe(
      'reversal',
    );
  });

  it('ignores transfers to a configured own account', () => {
    expect(
      classify({ ...base, counterpartyIban: 'SK0099000000000000000003' }, own)
        .ignoreReason,
    ).toBe('own_transfer');
  });

  it('ignores transfers to an account held under the owner name in any word order', () => {
    expect(
      classify({ ...base, counterpartyName: 'VZOROVA Jana' }, own).ignoreReason,
    ).toBe('own_transfer');
  });

  it('does not treat a card merchant as an own account just by name', () => {
    expect(
      classify(
        { ...base, counterpartyName: 'Jana Vzorova', counterpartyIban: null },
        own,
      ).status,
    ).toBe('NEEDS_REVIEW');
  });
});

describe('parseIbanList', () => {
  it('splits, trims and uppercases', () => {
    expect(parseIbanList(' sk00 9900, SK11 ,')).toEqual(['SK009900', 'SK11']);
    expect(parseIbanList(undefined)).toEqual([]);
  });
});
