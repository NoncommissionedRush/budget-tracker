import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let prisma: {
    category: { findFirst: jest.Mock };
    subcategory: { findFirst: jest.Mock };
    expense: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: ExpensesService;

  const dto = {
    categoryId: 'cat-1',
    amount: 10,
    description: 'Coffee',
    expenseDate: '2026-10-16',
  };

  beforeEach(() => {
    prisma = {
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
      subcategory: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
      expense: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    service = new ExpensesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('stores the expense date as the given calendar day', async () => {
      await service.create(dto);
      const { data } = prisma.expense.create.mock.calls[0][0];
      expect(data.expenseDate.toISOString()).toBe('2026-10-16T00:00:00.000Z');
    });

    it('rejects an unknown or inactive category', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'cat-1', isActive: true },
      });
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('rejects a subcategory from another category', async () => {
      prisma.subcategory.findFirst.mockResolvedValue(null);
      await expect(service.create({ ...dto, subcategoryId: 'sub-x' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.subcategory.findFirst).toHaveBeenCalledWith({
        where: { id: 'sub-x', categoryId: 'cat-1', isActive: true },
      });
      expect(prisma.expense.create).not.toHaveBeenCalled();
    });

    it('accepts a matching subcategory', async () => {
      await service.create({ ...dto, subcategoryId: 'sub-1' });
      expect(prisma.expense.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const existing = { id: 'exp-1', categoryId: 'cat-1', subcategoryId: 'sub-1' };

    it('returns 404 for an unknown expense', async () => {
      prisma.expense.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { amount: 5 })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not re-validate references when they are unchanged', async () => {
      prisma.expense.findUnique.mockResolvedValue(existing);
      await service.update('exp-1', { amount: 5 });
      expect(prisma.category.findFirst).not.toHaveBeenCalled();
      expect(prisma.subcategory.findFirst).not.toHaveBeenCalled();
    });

    it('rejects moving to a category the existing subcategory does not belong to', async () => {
      prisma.expense.findUnique.mockResolvedValue(existing);
      prisma.subcategory.findFirst.mockResolvedValue(null);
      await expect(service.update('exp-1', { categoryId: 'cat-2' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.subcategory.findFirst).toHaveBeenCalledWith({
        where: { id: 'sub-1', categoryId: 'cat-2', isActive: true },
      });
      expect(prisma.expense.update).not.toHaveBeenCalled();
    });

    it('allows changing category while clearing the subcategory', async () => {
      prisma.expense.findUnique.mockResolvedValue(existing);
      await service.update('exp-1', { categoryId: 'cat-2', subcategoryId: null as unknown as string });
      expect(prisma.subcategory.findFirst).not.toHaveBeenCalled();
      expect(prisma.expense.update).toHaveBeenCalled();
    });

    it('parses a new date as the given calendar day', async () => {
      prisma.expense.findUnique.mockResolvedValue(existing);
      await service.update('exp-1', { expenseDate: '2026-03-29' });
      const { data } = prisma.expense.update.mock.calls[0][0];
      expect(data.expenseDate.toISOString()).toBe('2026-03-29T00:00:00.000Z');
    });
  });

  describe('findAll', () => {
    it('filters and formats by calendar day', async () => {
      prisma.expense.findMany.mockReturnValue(
        Promise.resolve([{ id: 'e', expenseDate: new Date('2026-10-01T00:00:00.000Z') }]),
      );
      prisma.expense.count.mockReturnValue(Promise.resolve(1));
      const result = await service.findAll({ from: '2026-10-01', to: '2026-10-31' });
      const { where } = prisma.expense.findMany.mock.calls[0][0];
      expect(where.expenseDate.gte.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(where.expenseDate.lte.toISOString()).toBe('2026-10-31T00:00:00.000Z');
      expect(result.data[0].expenseDate).toBe('2026-10-01');
    });
  });
});
