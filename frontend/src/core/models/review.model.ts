import { RuleCondition } from './rule.model';

export interface ReviewTransaction {
  id: string;
  bookingDate: string;
  transactionDate: string | null;
  amount: string;
  currency: string;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  variableSymbol: string | null;
  description: string | null;
}

export interface CategorizeTransactionInput {
  categoryId: string;
  subcategoryId?: string;
  rule?: RuleCondition;
}

export interface ReviewDecisionResult {
  ruleId: string | null;
  alsoCategorized: number;
  alsoIgnored: number;
}
