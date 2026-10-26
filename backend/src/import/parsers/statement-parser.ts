export type Direction = 'DEBIT' | 'CREDIT';

export interface NormalizedTransaction {
  bankTransactionId: string;
  accountIban: string | null;
  bookingDate: string;
  valueDate: string | null;
  transactionDate: string | null;
  amount: string;
  currency: string;
  direction: Direction;
  isReversal: boolean;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  variableSymbol: string | null;
  constantSymbol: string | null;
  specificSymbol: string | null;
  description: string | null;
  bankTxCode: string | null;
}

export interface ParseError {
  entryRef: string | null;
  message: string;
}

export interface ParsedStatement {
  format: string;
  statementId: string | null;
  accountIban: string | null;
  accountOwnerName: string | null;
  transactions: NormalizedTransaction[];
  errors: ParseError[];
}

export interface StatementParser {
  readonly format: string;
  canParse(xml: string): boolean;
  parse(xml: string): ParsedStatement;
}

export class UnsupportedFormatError extends Error {}
