import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

const INCLUDE_SUBCATEGORIES = {
  subcategories: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' as const },
  },
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: INCLUDE_SUBCATEGORIES,
    });
  }

  create(dto: CreateCategoryDto) {
    const isUnbudgeted = dto.isUnbudgeted ?? false;
    return this.prisma.category.create({
      data: {
        name: dto.name,
        icon: dto.icon ?? 'tag',
        color: dto.color ?? '#6366f1',
        allocatedAmount: isUnbudgeted ? 0 : (dto.allocatedAmount ?? 0),
        isUnbudgeted,
        activeMonths: dto.activeMonths ?? [],
        sortOrder: dto.sortOrder ?? 0,
      },
      include: INCLUDE_SUBCATEGORIES,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.findOneOrFail(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.color !== undefined && { color: dto.color }),
        // Never update allocatedAmount for unbudgeted categories
        ...(!existing.isUnbudgeted && dto.allocatedAmount !== undefined && { allocatedAmount: dto.allocatedAmount }),
        ...(dto.activeMonths !== undefined && { activeMonths: dto.activeMonths }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: INCLUDE_SUBCATEGORIES,
    });
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
      include: INCLUDE_SUBCATEGORIES,
    });
  }

  async reorder(dto: ReorderCategoriesDto) {
    const updates = dto.order.map((id, index) =>
      this.prisma.category.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    await this.prisma.$transaction(updates);
    return this.findAll();
  }

  // ─── Subcategory methods ────────────────────────────────────────────────────

  async createSubcategory(categoryId: string, dto: CreateSubcategoryDto) {
    await this.findOneOrFail(categoryId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.subcategory.findMany({
        where: { categoryId, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      await tx.subcategory.create({
        data: {
          categoryId,
          name: dto.name,
          amount: dto.amount,
          sortOrder: dto.sortOrder ?? existing.length,
        },
      });
      return this.recalcAndReturn(categoryId, tx);
    });
  }

  async updateSubcategory(categoryId: string, subId: string, dto: UpdateSubcategoryDto) {
    await this.findSubOrFail(subId, categoryId);
    return this.prisma.$transaction(async (tx) => {
      await tx.subcategory.update({
        where: { id: subId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
      return this.recalcAndReturn(categoryId, tx);
    });
  }

  async removeSubcategory(categoryId: string, subId: string) {
    await this.findSubOrFail(subId, categoryId);
    return this.prisma.$transaction(async (tx) => {
      await tx.subcategory.update({
        where: { id: subId },
        data: { isActive: false },
      });
      return this.recalcAndReturn(categoryId, tx);
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Recalculates category.allocatedAmount = sum of active subcategories, then returns updated category */
  private async recalcAndReturn(
    categoryId: string,
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
  ) {
    const subs = await tx.subcategory.findMany({
      where: { categoryId, isActive: true },
    });
    const total = subs.reduce(
      (acc, sub) => acc.plus(new Decimal(sub.amount.toString())),
      new Decimal(0),
    );
    const updated = await tx.category.update({
      where: { id: categoryId },
      data: { allocatedAmount: total.toFixed(2) },
      include: INCLUDE_SUBCATEGORIES,
    });
    return updated;
  }

  private async findOneOrFail(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  private async findSubOrFail(subId: string, categoryId: string) {
    const sub = await this.prisma.subcategory.findFirst({
      where: { id: subId, categoryId, isActive: true },
    });
    if (!sub) throw new NotFoundException(`Subcategory ${subId} not found`);
    return sub;
  }
}
