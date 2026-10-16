import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertIncomeDto } from './dto/upsert-income.dto';

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getIncomeConfig() {
    return this.prisma.incomeConfig.findFirst();
  }

  async upsertIncomeConfig(dto: UpsertIncomeDto) {
    const existing = await this.prisma.incomeConfig.findFirst();
    if (existing) {
      return this.prisma.incomeConfig.update({
        where: { id: existing.id },
        data: {
          monthlyAmount: dto.monthlyAmount,
          incomeDay: dto.incomeDay,
        },
      });
    }
    return this.prisma.incomeConfig.create({
      data: {
        monthlyAmount: dto.monthlyAmount,
        incomeDay: dto.incomeDay,
      },
    });
  }
}
