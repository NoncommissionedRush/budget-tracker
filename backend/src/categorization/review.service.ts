import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BankTransaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateOnly } from '../common/date-only';
import { CategorizationService } from './categorization.service';
import { RulesService } from './rules.service';
import {
  CategorizeTransactionDto,
  IgnoreTransactionDto,
} from './dto/review-decision.dto';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categorization: CategorizationService,
    private readonly rules: RulesService,
  ) {}

  async findPending() {
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { status: 'NEEDS_REVIEW' },
      orderBy: [{ bookingDate: 'desc' }, { createdAt: 'desc' }],
    });
    return transactions.map(toView);
  }

  async categorize(id: string, dto: CategorizeTransactionDto) {
    const tx = await this.findPendingOrFail(id);
    const subcategoryId = dto.subcategoryId ?? null;
    await this.rules.assertTarget(dto.categoryId, subcategoryId);
    const rule = dto.rule
      ? await this.rules.create({
          ...dto.rule,
          action: 'CATEGORIZE',
          categoryId: dto.categoryId,
          subcategoryId,
        })
      : null;

    await this.categorization.assign(
      tx,
      { categoryId: dto.categoryId, subcategoryId },
      rule ? 'RULE' : 'MANUAL',
      rule?.id ?? null,
    );
    return this.afterDecision(rule);
  }

  async ignore(id: string, dto: IgnoreTransactionDto) {
    await this.findPendingOrFail(id);
    const rule = dto.rule
      ? await this.rules.create({ ...dto.rule, action: 'IGNORE' })
      : null;

    await this.prisma.bankTransaction.update({
      where: { id },
      data: {
        status: 'IGNORED',
        ignoreReason: rule ? 'rule' : 'manual',
        categorizedBy: rule ? 'RULE' : 'MANUAL',
        ruleId: rule?.id ?? null,
      },
    });
    return this.afterDecision(rule);
  }

  // A new rule can settle other transactions still waiting in the inbox.
  private async afterDecision(rule: { id: string } | null) {
    const applied = rule ? await this.categorization.categorizePending() : null;
    return {
      ruleId: rule?.id ?? null,
      alsoCategorized: applied?.categorized ?? 0,
      alsoIgnored: applied?.ignored ?? 0,
    };
  }

  private async findPendingOrFail(id: string) {
    const tx = await this.prisma.bankTransaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    if (tx.status !== 'NEEDS_REVIEW') {
      throw new BadRequestException(
        `Transaction ${id} is not waiting for review`,
      );
    }
    return tx;
  }
}

function toView(tx: BankTransaction) {
  return {
    id: tx.id,
    bookingDate: formatDateOnly(tx.bookingDate),
    transactionDate: tx.transactionDate
      ? formatDateOnly(tx.transactionDate)
      : null,
    amount: tx.amount.toFixed(2),
    currency: tx.currency,
    counterpartyName: tx.counterpartyName,
    counterpartyIban: tx.counterpartyIban,
    variableSymbol: tx.variableSymbol,
    description: tx.description,
  };
}
