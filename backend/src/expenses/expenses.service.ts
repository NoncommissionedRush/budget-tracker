import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { formatDateOnly, parseDateOnly } from '../common/date-only';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ExpenseQueryDto) {
    const { from, to, categoryId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (from || to) {
      where.expenseDate = {};
      if (from) where.expenseDate.gte = parseDateOnly(from);
      if (to) where.expenseDate.lte = parseDateOnly(to);
    }
    if (categoryId) where.categoryId = categoryId;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: { category: true },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: data.map((e) => ({
        ...e,
        expenseDate: formatDateOnly(e.expenseDate),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateExpenseDto) {
    await this.assertActiveCategory(dto.categoryId);
    if (dto.subcategoryId) {
      await this.assertSubcategoryOf(dto.subcategoryId, dto.categoryId);
    }
    return this.prisma.expense.create({
      data: {
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId ?? null,
        amount: dto.amount,
        description: dto.description,
        expenseDate: parseDateOnly(dto.expenseDate),
      },
      include: { category: true, subcategory: true },
    });
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const existing = await this.findOneOrFail(id);
    if (dto.categoryId !== undefined) {
      await this.assertActiveCategory(dto.categoryId);
    }
    if (dto.categoryId !== undefined || dto.subcategoryId !== undefined) {
      // Validate the combination the expense will end up with
      const categoryId = dto.categoryId ?? existing.categoryId;
      const subcategoryId =
        dto.subcategoryId !== undefined ? dto.subcategoryId : existing.subcategoryId;
      if (subcategoryId) {
        await this.assertSubcategoryOf(subcategoryId, categoryId);
      }
    }
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.subcategoryId !== undefined && { subcategoryId: dto.subcategoryId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.expenseDate !== undefined && { expenseDate: parseDateOnly(dto.expenseDate) }),
      },
      include: { category: true, subcategory: true },
    });
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    await this.prisma.expense.delete({ where: { id } });
  }

  private async assertActiveCategory(categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
    });
    if (!category) {
      throw new BadRequestException(`Category ${categoryId} does not exist or is inactive`);
    }
  }

  private async assertSubcategoryOf(subcategoryId: string, categoryId: string) {
    const sub = await this.prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoryId, isActive: true },
    });
    if (!sub) {
      throw new BadRequestException(
        `Subcategory ${subcategoryId} does not belong to category ${categoryId}`,
      );
    }
  }

  private async findOneOrFail(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }
}
