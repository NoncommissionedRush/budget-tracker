import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { RulesService } from './rules.service';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  let prisma: any;
  let categorization: { assign: jest.Mock; categorizePending: jest.Mock };
  let rules: { create: jest.Mock; assertTarget: jest.Mock };
  let service: ReviewService;
  const tx = { id: 't1', status: 'NEEDS_REVIEW' };

  beforeEach(() => {
    prisma = {
      bankTransaction: {
        findUnique: jest.fn().mockResolvedValue(tx),
        update: jest.fn(),
      },
    };
    categorization = {
      assign: jest.fn(),
      categorizePending: jest
        .fn()
        .mockResolvedValue({ categorized: 3, ignored: 1, remaining: 2 }),
    };
    rules = {
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      assertTarget: jest.fn(),
    };
    service = new ReviewService(
      prisma as PrismaService,
      categorization as unknown as CategorizationService,
      rules as unknown as RulesService,
    );
  });

  it('categorizes manually without touching rules', async () => {
    const result = await service.categorize('t1', {
      categoryId: 'cat',
      subcategoryId: 'sub',
    });
    expect(rules.assertTarget).toHaveBeenCalledWith('cat', 'sub');
    expect(categorization.assign).toHaveBeenCalledWith(
      tx,
      { categoryId: 'cat', subcategoryId: 'sub' },
      'MANUAL',
      null,
    );
    expect(rules.create).not.toHaveBeenCalled();
    expect(categorization.categorizePending).not.toHaveBeenCalled();
    expect(result).toEqual({
      ruleId: null,
      alsoCategorized: 0,
      alsoIgnored: 0,
    });
  });

  it('"always do this" creates a rule and applies it to the rest of the inbox', async () => {
    const result = await service.categorize('t1', {
      categoryId: 'cat',
      rule: {
        field: 'COUNTERPARTY_NAME',
        matchType: 'CONTAINS',
        pattern: 'coffee',
      },
    });
    expect(rules.create).toHaveBeenCalledWith({
      field: 'COUNTERPARTY_NAME',
      matchType: 'CONTAINS',
      pattern: 'coffee',
      action: 'CATEGORIZE',
      categoryId: 'cat',
      subcategoryId: null,
    });
    expect(categorization.assign).toHaveBeenCalledWith(
      tx,
      { categoryId: 'cat', subcategoryId: null },
      'RULE',
      'r1',
    );
    expect(result).toEqual({
      ruleId: 'r1',
      alsoCategorized: 3,
      alsoIgnored: 1,
    });
  });

  it('ignores a transaction, optionally with a rule', async () => {
    await service.ignore('t1', {});
    expect(prisma.bankTransaction.update).toHaveBeenLastCalledWith({
      where: { id: 't1' },
      data: {
        status: 'IGNORED',
        ignoreReason: 'manual',
        categorizedBy: 'MANUAL',
        ruleId: null,
      },
    });

    await service.ignore('t1', {
      rule: { field: 'DESCRIPTION', pattern: 'atm' },
    });
    expect(rules.create).toHaveBeenCalledWith({
      field: 'DESCRIPTION',
      pattern: 'atm',
      action: 'IGNORE',
    });
    expect(prisma.bankTransaction.update).toHaveBeenLastCalledWith({
      where: { id: 't1' },
      data: {
        status: 'IGNORED',
        ignoreReason: 'rule',
        categorizedBy: 'RULE',
        ruleId: 'r1',
      },
    });
  });

  it('refuses transactions that are not waiting for review', async () => {
    prisma.bankTransaction.findUnique.mockResolvedValue({
      ...tx,
      status: 'CATEGORIZED',
    });
    await expect(
      service.categorize('t1', { categoryId: 'cat' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(categorization.assign).not.toHaveBeenCalled();
  });
});
