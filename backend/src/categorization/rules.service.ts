import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategorizationRule, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategorizationService } from './categorization.service';
import { normalizeIban, normalizeSymbol } from './categorizer';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { ReorderRulesDto } from './dto/reorder-rules.dto';

const INCLUDE_TARGET = { category: true, subcategory: true };

type RuleData = Pick<
  CategorizationRule,
  'field' | 'matchType' | 'pattern' | 'action' | 'categoryId' | 'subcategoryId'
> & { amountMin: string | null; amountMax: string | null };

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categorization: CategorizationService,
  ) {}

  findAll() {
    return this.prisma.categorizationRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: INCLUDE_TARGET,
    });
  }

  async create(dto: CreateRuleDto) {
    const data = await this.validate({
      field: dto.field ?? null,
      matchType: dto.matchType ?? 'CONTAINS',
      pattern: dto.pattern ?? null,
      amountMin: toAmount(dto.amountMin),
      amountMax: toAmount(dto.amountMax),
      action: dto.action ?? 'CATEGORIZE',
      categoryId: dto.categoryId ?? null,
      subcategoryId: dto.subcategoryId ?? null,
    });
    const last = await this.prisma.categorizationRule.aggregate({
      _max: { priority: true },
    });
    return this.prisma.categorizationRule.create({
      data: { ...data, priority: (last._max.priority ?? -1) + 1 },
      include: INCLUDE_TARGET,
    });
  }

  async update(id: string, dto: UpdateRuleDto) {
    const existing = await this.findOneOrFail(id);
    const categoryChanged =
      dto.categoryId !== undefined && dto.categoryId !== existing.categoryId;
    const data = await this.validate({
      field: dto.field !== undefined ? dto.field : existing.field,
      matchType: dto.matchType ?? existing.matchType,
      pattern: dto.pattern !== undefined ? dto.pattern : existing.pattern,
      amountMin:
        dto.amountMin !== undefined
          ? toAmount(dto.amountMin)
          : (existing.amountMin?.toString() ?? null),
      amountMax:
        dto.amountMax !== undefined
          ? toAmount(dto.amountMax)
          : (existing.amountMax?.toString() ?? null),
      action: dto.action ?? existing.action,
      categoryId:
        dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
      subcategoryId:
        dto.subcategoryId !== undefined
          ? dto.subcategoryId
          : categoryChanged
            ? null
            : existing.subcategoryId,
    });
    return this.prisma.categorizationRule.update({
      where: { id },
      data,
      include: INCLUDE_TARGET,
    });
  }

  async remove(id: string) {
    await this.findOneOrFail(id);
    await this.prisma.categorizationRule.delete({ where: { id } });
  }

  async reorder(dto: ReorderRulesDto) {
    const found = await this.prisma.categorizationRule.findMany({
      where: { id: { in: dto.order } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((r) => r.id));
    const unknown = dto.order.filter((id) => !foundIds.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown rules: ${unknown.join(', ')}`);
    }
    await this.prisma.$transaction(
      dto.order.map((id, index) =>
        this.prisma.categorizationRule.update({
          where: { id },
          data: { priority: index },
        }),
      ),
    );
    return this.findAll();
  }

  /** Re-runs the pipeline over everything waiting for review. */
  apply() {
    return this.categorization.categorizePending();
  }

  async validate(
    data: RuleData,
  ): Promise<Prisma.CategorizationRuleUncheckedCreateInput> {
    const pattern = data.pattern?.trim() || null;
    if (data.field && !pattern) {
      throw new BadRequestException(
        'A rule that matches a field needs a pattern',
      );
    }
    if (!data.field && data.amountMin === null && data.amountMax === null) {
      throw new BadRequestException(
        'A rule needs a field to match or an amount range',
      );
    }
    if (
      data.amountMin !== null &&
      data.amountMax !== null &&
      new Prisma.Decimal(data.amountMin).greaterThan(data.amountMax)
    ) {
      throw new BadRequestException(
        'amountMin must not be greater than amountMax',
      );
    }

    if (data.action === 'IGNORE') {
      data = { ...data, categoryId: null, subcategoryId: null };
    } else {
      if (!data.categoryId) {
        throw new BadRequestException('A categorizing rule needs a category');
      }
      await this.assertTarget(data.categoryId, data.subcategoryId);
    }

    return {
      ...data,
      pattern: data.field ? normalizePattern(data.field, pattern!) : null,
      matchType: data.field ? data.matchType : 'CONTAINS',
    };
  }

  async assertTarget(categoryId: string, subcategoryId: string | null) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
    });
    if (!category) {
      throw new BadRequestException(
        `Category ${categoryId} does not exist or is inactive`,
      );
    }
    if (subcategoryId) {
      const sub = await this.prisma.subcategory.findFirst({
        where: { id: subcategoryId, categoryId, isActive: true },
      });
      if (!sub) {
        throw new BadRequestException(
          `Subcategory ${subcategoryId} does not belong to category ${categoryId}`,
        );
      }
    }
  }

  private async findOneOrFail(id: string) {
    const rule = await this.prisma.categorizationRule.findUnique({
      where: { id },
    });
    if (!rule) throw new NotFoundException(`Rule ${id} not found`);
    return rule;
  }
}

function toAmount(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toFixed(2);
}

function normalizePattern(
  field: CategorizationRule['field'],
  pattern: string,
): string {
  if (field === 'COUNTERPARTY_IBAN') return normalizeIban(pattern);
  if (field === 'VARIABLE_SYMBOL') return normalizeSymbol(pattern);
  return pattern;
}
