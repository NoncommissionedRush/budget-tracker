import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { format } from 'date-fns';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ExpenseQueryDto) {
    const { from, to, categoryId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (from || to) {
      where.expenseDate = {};
      if (from) where.expenseDate.gte = new Date(from);
      if (to) where.expenseDate.lte = new Date(to);
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
        expenseDate: format(e.expenseDate, 'yyyy-MM-dd'),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  create(dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId ?? null,
        amount: dto.amount,
        description: dto.description,
        expenseDate: new Date(dto.expenseDate),
      },
      include: { category: true, subcategory: true },
    });
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOneOrFail(id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.subcategoryId !== undefined && { subcategoryId: dto.subcategoryId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.expenseDate !== undefined && { expenseDate: new Date(dto.expenseDate) }),
      },
      include: { category: true, subcategory: true },
    });
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    await this.prisma.expense.delete({ where: { id } });
  }

  private async findOneOrFail(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }
}
