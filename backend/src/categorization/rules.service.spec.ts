import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { RulesService } from './rules.service';

describe('RulesService', () => {
  let prisma: any;
  let service: RulesService;

  beforeEach(() => {
    prisma = {
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'cat' }) },
      subcategory: { findFirst: jest.fn().mockResolvedValue({ id: 'sub' }) },
      categorizationRule: {
        aggregate: jest.fn().mockResolvedValue({ _max: { priority: 4 } }),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'new', ...data })),
        update: jest.fn(({ data }) => Promise.resolve(data)),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new RulesService(
      prisma as PrismaService,
      {} as CategorizationService,
    );
  });

  const created = () => prisma.categorizationRule.create.mock.calls[0][0].data;

  it('adds a new rule after the existing ones with a normalized pattern', async () => {
    await service.create({
      field: 'COUNTERPARTY_IBAN',
      matchType: 'EQUALS',
      pattern: ' sk00 9900 0000 0000 0000 0102 ',
      categoryId: 'cat',
      subcategoryId: 'sub',
    });
    expect(created()).toEqual({
      field: 'COUNTERPARTY_IBAN',
      matchType: 'EQUALS',
      pattern: 'SK0099000000000000000102',
      amountMin: null,
      amountMax: null,
      action: 'CATEGORIZE',
      categoryId: 'cat',
      subcategoryId: 'sub',
      priority: 5,
    });
  });

  it('starts at priority 0 when there are no rules', async () => {
    prisma.categorizationRule.aggregate.mockResolvedValue({
      _max: { priority: null },
    });
    await service.create({
      field: 'DESCRIPTION',
      pattern: 'x',
      categoryId: 'cat',
    });
    expect(created().priority).toBe(0);
  });

  it('stores amounts with two decimals', async () => {
    await service.create({ amountMin: 10, amountMax: 20.5, categoryId: 'cat' });
    expect(created()).toMatchObject({
      field: null,
      pattern: null,
      amountMin: '10.00',
      amountMax: '20.50',
    });
  });

  it('drops the category of an ignore rule', async () => {
    await service.create({
      field: 'DESCRIPTION',
      pattern: 'x',
      action: 'IGNORE',
      categoryId: 'cat',
    });
    expect(created()).toMatchObject({ categoryId: null, subcategoryId: null });
    expect(prisma.category.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    [{ categoryId: 'cat' }, 'needs a field to match or an amount range'],
    [
      { field: 'DESCRIPTION' as const, pattern: '  ', categoryId: 'cat' },
      'needs a pattern',
    ],
    [{ amountMin: 5, amountMax: 1, categoryId: 'cat' }, 'amountMin'],
    [{ field: 'DESCRIPTION' as const, pattern: 'x' }, 'needs a category'],
  ])('rejects %j', async (dto, message) => {
    await expect(service.create(dto)).rejects.toThrow(message);
    expect(prisma.categorizationRule.create).not.toHaveBeenCalled();
  });

  it('rejects a subcategory from another category', async () => {
    prisma.subcategory.findFirst.mockResolvedValue(null);
    await expect(
      service.create({
        field: 'DESCRIPTION',
        pattern: 'x',
        categoryId: 'cat',
        subcategoryId: 'other',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears the subcategory when an update moves the rule to another category', async () => {
    prisma.categorizationRule.findUnique.mockResolvedValue({
      id: 'r1',
      field: 'DESCRIPTION',
      matchType: 'CONTAINS',
      pattern: 'x',
      amountMin: null,
      amountMax: null,
      action: 'CATEGORIZE',
      categoryId: 'cat',
      subcategoryId: 'sub',
    });
    const data = await service.update('r1', { categoryId: 'cat-2' });
    expect(data).toMatchObject({ categoryId: 'cat-2', subcategoryId: null });
  });

  it('rejects reordering with unknown rules', async () => {
    prisma.categorizationRule.findMany.mockResolvedValue([{ id: 'a' }]);
    await expect(service.reorder({ order: ['a', 'ghost'] })).rejects.toThrow(
      'ghost',
    );
  });
});
