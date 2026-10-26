import { readFileSync } from 'fs';
import { join } from 'path';
import { CamtParser, parseSymbols } from './camt-parser';
import { parseStatement, UnsupportedFormatError } from '.';

const fixture = readFileSync(
  join(__dirname, '__fixtures__/camt053-synthetic.xml'),
  'utf8',
);
const OWN = 'SK0099000000000000000001';

describe('CamtParser', () => {
  const parser = new CamtParser();
  const statement = parser.parse(fixture);
  const byRef = (ref: string) =>
    statement.transactions.find(
      (t) => t.bankTransactionId === `${OWN}:${ref}`,
    )!;

  it('detects camt.053 and reads the statement header', () => {
    expect(parser.canParse(fixture)).toBe(true);
    expect(statement).toMatchObject({
      format: 'camt.053.001.02',
      statementId: `${OWN}-2026-10-25`,
      accountIban: OWN,
      accountOwnerName: 'Jana Vzorova',
    });
  });

  it('returns booked entries only and reports entries it cannot read', () => {
    expect(statement.transactions).toHaveLength(8);
    expect(byRef('1000000007')).toBeUndefined();
    expect(statement.errors).toEqual([
      {
        entryRef: '1000000009',
        message: expect.stringContaining('credit/debit indicator'),
      },
    ]);
  });

  it('normalizes a SEPA payment with symbols', () => {
    expect(byRef('1000000002')).toEqual({
      bankTransactionId: `${OWN}:1000000002`,
      accountIban: OWN,
      bookingDate: '2026-10-25',
      valueDate: '2026-10-25',
      transactionDate: null,
      amount: '54.50',
      currency: 'EUR',
      direction: 'DEBIT',
      isReversal: false,
      counterpartyName: 'Example Insurance',
      counterpartyIban: 'SK0099000000000000000102',
      variableSymbol: '5555000011',
      specificSymbol: '42',
      constantSymbol: '3558',
      description: 'Okamzita platba (elektronicky)',
      bankTxCode: '10000404000',
    });
  });

  it('treats NOTPROVIDED as a missing name', () => {
    expect(byRef('1000000001')).toMatchObject({
      counterpartyName: null,
      counterpartyIban: 'SK0099000000000000000101',
      variableSymbol: '1234567890',
      constantSymbol: '0308',
      specificSymbol: null,
    });
  });

  it('normalizes a card payment with the card-use date and merchant', () => {
    expect(byRef('1000000004')).toMatchObject({
      amount: '8.99',
      direction: 'DEBIT',
      bookingDate: '2026-10-25',
      transactionDate: '2026-10-24',
      counterpartyName: 'EXAMPLE STREAMING-CORK',
      counterpartyIban: null,
      description: 'Platba kartou',
      bankTxCode: '30000201000',
    });
  });

  it('takes the debtor as counterparty for credits', () => {
    expect(byRef('1000000003')).toMatchObject({
      direction: 'CREDIT',
      counterpartyName: 'Jana Vzorova',
      counterpartyIban: 'SK0099000000000000000002',
    });
  });

  it('flags reversals', () => {
    expect(byRef('1000000008')).toMatchObject({
      direction: 'CREDIT',
      isReversal: true,
    });
  });

  it('parses camt.052 reports with the same structure', () => {
    const report = fixture
      .replace('camt.053.001.02', 'camt.052.001.02')
      .replace(/BkToCstmrStmt>/g, 'BkToCstmrAcctRpt>')
      .replace(/<(\/?)Stmt>/g, '<$1Rpt>');
    const parsed = parseStatement(report);
    expect(parsed.format).toBe('camt.052.001.02');
    expect(parsed.transactions).toHaveLength(8);
  });

  it('splits batch entries into one transaction per TxDtls', () => {
    const batch = fixture.replace(
      /<Ntry><NtryRef>1000000010<\/NtryRef>.*?<\/Ntry>/,
      `<Ntry><NtryRef>2000000001</NtryRef><Amt Ccy="EUR">30</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>BOOK</Sts>
       <BookgDt><Dt>2026-10-25</Dt></BookgDt><NtryDtls>
       <TxDtls><Refs><AcctSvcrRef>A1</AcctSvcrRef></Refs><AmtDtls><TxAmt><Amt Ccy="EUR">10</Amt></TxAmt></AmtDtls></TxDtls>
       <TxDtls><Refs><AcctSvcrRef>A2</AcctSvcrRef></Refs><AmtDtls><TxAmt><Amt Ccy="EUR">20</Amt></TxAmt></AmtDtls></TxDtls>
       </NtryDtls></Ntry>`,
    );
    const ids = parser
      .parse(batch)
      .transactions.filter((t) => t.bankTransactionId.includes('2000000001'))
      .map((t) => [t.bankTransactionId, t.amount]);
    expect(ids).toEqual([
      [`${OWN}:2000000001/A1`, '10.00'],
      [`${OWN}:2000000001/A2`, '20.00'],
    ]);
  });

  it('rejects documents that are not camt', () => {
    expect(() => parseStatement('<Document xmlns="urn:example"/>')).toThrow(
      UnsupportedFormatError,
    );
  });
});

describe('parseSymbols', () => {
  it.each([
    [
      '/VS123/SS456/KS0308',
      { variableSymbol: '123', specificSymbol: '456', constantSymbol: '0308' },
    ],
    [
      '/VS/SS/KS',
      { variableSymbol: null, specificSymbol: null, constantSymbol: null },
    ],
    [
      'NOTPROVIDED',
      { variableSymbol: null, specificSymbol: null, constantSymbol: null },
    ],
    [
      null,
      { variableSymbol: null, specificSymbol: null, constantSymbol: null },
    ],
  ])('%s', (input, expected) => {
    expect(parseSymbols(input)).toEqual(expected);
  });
});
