import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService.reorder', () => {
  let prisma: {
    category: { findMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: CategoriesService;

  beforeEach(() => {
    prisma = {
      category: { findMany: jest.fn(), update: jest.fn().mockReturnValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  it('rejects unknown ids without touching the order', async () => {
    prisma.category.findMany.mockResolvedValueOnce([{ id: 'a' }]);
    await expect(service.reorder({ order: ['a', 'ghost'] })).rejects.toThrow(
      new BadRequestException('Unknown or inactive categories: ghost'),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates sort order for known ids', async () => {
    prisma.category.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce([]);
    await service.reorder({ order: ['b', 'a'] });
    expect(prisma.category.update).toHaveBeenNthCalledWith(1, { where: { id: 'b' }, data: { sortOrder: 0 } });
    expect(prisma.category.update).toHaveBeenNthCalledWith(2, { where: { id: 'a' }, data: { sortOrder: 1 } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
