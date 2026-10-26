import { NormalizedTransaction } from './parsers';

export type ClassifiedStatus = 'NEEDS_REVIEW' | 'IGNORED';

export interface Classification {
  status: ClassifiedStatus;
  ignoreReason: string | null;
}

export interface OwnAccounts {
  ibans: Set<string>;
  ownerName: string | null;
}

export function classify(
  tx: NormalizedTransaction,
  own: OwnAccounts,
): Classification {
  if (tx.isReversal) return { status: 'IGNORED', ignoreReason: 'reversal' };
  if (isOwnTransfer(tx, own))
    return { status: 'IGNORED', ignoreReason: 'own_transfer' };
  if (tx.direction === 'CREDIT')
    return { status: 'IGNORED', ignoreReason: 'credit' };
  return { status: 'NEEDS_REVIEW', ignoreReason: null };
}

function isOwnTransfer(tx: NormalizedTransaction, own: OwnAccounts): boolean {
  if (tx.counterpartyIban && own.ibans.has(tx.counterpartyIban)) return true;
  // The bank lists the owner as "Surname Name" on one side and "Name Surname" on the other.
  return (
    !!tx.counterpartyIban &&
    !!own.ownerName &&
    !!tx.counterpartyName &&
    nameKey(tx.counterpartyName) === nameKey(own.ownerName)
  );
}

function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[\s,.]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

export function parseIbanList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.replace(/\s+/g, '').toUpperCase())
    .filter(Boolean);
}
