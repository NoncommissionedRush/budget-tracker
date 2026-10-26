import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { IncomeModule } from './income/income.module';
import { CategoriesModule } from './categories/categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ImportModule } from './import/import.module';
import { CategorizationModule } from './categorization/categorization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IncomeModule,
    CategoriesModule,
    ExpensesModule,
    DashboardModule,
    ImportModule,
    CategorizationModule,
  ],
})
export class AppModule {}
