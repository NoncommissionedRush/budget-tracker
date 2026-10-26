import Decimal from 'decimal.js';
import { XMLParser } from 'fast-xml-parser';
import {
  NormalizedTransaction,
  ParseError,
  ParsedStatement,
  StatementParser,
  UnsupportedFormatError,
} from './statement-parser';

type Node = Record<string, any>;

const VARIANTS = {
  '053': { root: 'BkToCstmrStmt', item: 'Stmt' },
  '052': { root: 'BkToCstmrAcctRpt', item: 'Rpt' },
} as const;

const ARRAY_TAGS = new Set([
  'Stmt',
  'Rpt',
  'Ntry',
  'TxDtls',
  'Ustrd',
  'Bal',
  'Prtry',
]);

// Banks fill empty name/reference fields with this literal instead of omitting them.
const PLACEHOLDERS = new Set(['NOTPROVIDED', 'NOT PROVIDED']);

/** ISO 20022 camt.053 (statement) and camt.052 (intraday report); same entry structure. */
export class CamtParser implements StatementParser {
  readonly format = 'camt.05x';

  private readonly xml = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true,
    isArray: (name) => ARRAY_TAGS.has(name),
  });

  canParse(xml: string): boolean {
    return /urn:iso:std:iso:20022:tech:xsd:camt\.05[23]\./.test(
      xml.slice(0, 2000),
    );
  }

  parse(xml: string): ParsedStatement {
    const ns =
      /urn:iso:std:iso:20022:tech:xsd:(camt\.(05[23])\.\d{3}\.\d{2})/.exec(
        xml.slice(0, 2000),
      );
    if (!ns)
      throw new UnsupportedFormatError('Not a camt.052/camt.053 document');
    const variant = VARIANTS[ns[2] as keyof typeof VARIANTS];

    const doc = this.xml.parse(xml) as Node;
    const items: Node[] = doc?.Document?.[variant.root]?.[variant.item];
    if (!items?.length)
      throw new UnsupportedFormatError(`No <${variant.item}> element found`);

    const transactions: NormalizedTransaction[] = [];
    const errors: ParseError[] = [];
    const first = items[0];

    for (const stmt of items) {
      const accountIban = normalizeIban(stmt.Acct?.Id?.IBAN);
      for (const entry of stmt.Ntry ?? []) {
        const ref = text(entry.NtryRef) ?? text(entry.AcctSvcrRef);
        if (text(entry.Sts?.Cd ?? entry.Sts) !== 'BOOK') continue;
        try {
          transactions.push(...this.normalizeEntry(entry, accountIban));
        } catch (e) {
          errors.push({ entryRef: ref, message: (e as Error).message });
        }
      }
    }

    return {
      format: ns[1],
      statementId: text(first.Id),
      accountIban: normalizeIban(first.Acct?.Id?.IBAN),
      accountOwnerName: text(first.Acct?.Ownr?.Nm) ?? text(first.Acct?.Nm),
      transactions,
      errors,
    };
  }

  private normalizeEntry(
    entry: Node,
    accountIban: string | null,
  ): NormalizedTransaction[] {
    const direction = parseDirection(entry.CdtDbtInd);
    const bookingDate = parseDate(entry.BookgDt);
    if (!bookingDate) throw new Error('Missing booking date');
    const entryRef = text(entry.NtryRef) ?? text(entry.AcctSvcrRef);
    const details: Node[] = entry.NtryDtls?.TxDtls ?? [{}];
    // A batch entry carries one TxDtls per underlying payment, each with its own amount.
    const batch = details.length > 1;

    return details.map((tx, i) => {
      const amountNode = batch ? (tx.AmtDtls?.TxAmt?.Amt ?? tx.Amt) : entry.Amt;
      const { amount, currency } = parseAmount(amountNode);
      const txDirection =
        batch && tx.CdtDbtInd ? parseDirection(tx.CdtDbtInd) : direction;
      const txRef = text(tx.Refs?.AcctSvcrRef);
      const baseId = batch
        ? `${entryRef ?? ''}/${txRef ?? i}`
        : (entryRef ?? txRef);
      if (!baseId)
        throw new Error('Entry has no reference to use as transaction ID');

      const parties = tx.RltdPties ?? {};
      const counterparty =
        txDirection === 'DEBIT'
          ? { party: parties.Cdtr, account: parties.CdtrAcct }
          : { party: parties.Dbtr, account: parties.DbtrAcct };
      const symbols = parseSymbols(text(tx.Refs?.EndToEndId));
      const remittance = tx.RmtInf?.Ustrd as unknown[] | undefined;

      return {
        bankTransactionId: accountIban ? `${accountIban}:${baseId}` : baseId,
        accountIban,
        bookingDate,
        valueDate: parseDate(entry.ValDt),
        transactionDate: parseCardDate(tx.RltdDts),
        amount,
        currency,
        direction: txDirection,
        isReversal: text(entry.RvslInd) === 'true',
        counterpartyName:
          clean(counterparty.party?.Nm) ??
          clean(counterparty.account?.Nm) ??
          null,
        counterpartyIban: normalizeIban(counterparty.account?.Id?.IBAN),
        ...symbols,
        description:
          remittance?.map(text).filter(Boolean).join(' ') ||
          text(entry.AddtlNtryInf) ||
          null,
        bankTxCode: parseBankTxCode(tx.BkTxCd ?? entry.BkTxCd),
      };
    });
  }
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return text((value as Node)['#text']);
  const s = String(value).trim();
  return s === '' ? null : s;
}

function clean(value: unknown): string | null {
  const s = text(value);
  return s && !PLACEHOLDERS.has(s.toUpperCase()) ? s : null;
}

function normalizeIban(value: unknown): string | null {
  const s = text(value);
  return s ? s.replace(/\s+/g, '').toUpperCase() : null;
}

function parseDirection(value: unknown): 'DEBIT' | 'CREDIT' {
  const s = text(value);
  if (s === 'DBIT') return 'DEBIT';
  if (s === 'CRDT') return 'CREDIT';
  throw new Error(`Unknown credit/debit indicator: ${s}`);
}

function parseAmount(node: unknown): { amount: string; currency: string } {
  const value = text(node);
  const currency = text((node as Node | undefined)?.['@_Ccy']);
  if (!value || !currency) throw new Error('Missing amount or currency');
  let amount: Decimal;
  try {
    amount = new Decimal(value);
  } catch {
    throw new Error(`Invalid amount: ${value}`);
  }
  if (amount.isNegative() || !amount.isFinite())
    throw new Error(`Invalid amount: ${value}`);
  return { amount: amount.toFixed(2), currency };
}

function parseDate(node: Node | undefined): string | null {
  const value = text(node?.Dt) ?? text(node?.DtTm);
  return value ? toDateOnly(value) : null;
}

function toDateOnly(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  return match[1];
}

function parseCardDate(related: Node | undefined): string | null {
  const prtry: Node[] = related?.Prtry ?? [];
  const value =
    text(prtry[0]?.Dt?.DtTm) ?? text(prtry[0]?.Dt?.Dt) ?? text(related?.TxDtTm);
  return value ? toDateOnly(value) : null;
}

function parseBankTxCode(node: Node | undefined): string | null {
  if (!node) return null;
  const prtry: Node | undefined = Array.isArray(node.Prtry)
    ? node.Prtry[0]
    : node.Prtry;
  const proprietary = text(prtry?.Cd);
  if (proprietary) return proprietary;
  const domain = node.Domn;
  if (!domain) return null;
  return [text(domain.Cd), text(domain.Fmly?.Cd), text(domain.Fmly?.SubFmlyCd)]
    .filter(Boolean)
    .join('/');
}

/** Slovak payment symbols are packed into EndToEndId as `/VS<digits>/SS<digits>/KS<digits>`. */
export function parseSymbols(endToEndId: string | null) {
  const pick = (key: string) => {
    const match = new RegExp(`/${key}([^/]*)`).exec(endToEndId ?? '');
    return match && match[1] ? match[1] : null;
  };
  return {
    variableSymbol: pick('VS'),
    specificSymbol: pick('SS'),
    constantSymbol: pick('KS'),
  };
}
