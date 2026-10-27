import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { IncomeModule } from './income/income.module';
import { CategoriesModule } from './categories/categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ImportModule } from './import/import.module';
import { CategorizationModule } from './categorization/categorization.module';

const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');

// Serve the built Angular app from the API's origin when a build exists; `ng serve` covers dev.
const frontendModules = existsSync(join(frontendDist, 'index.html'))
  ? [ServeStaticModule.forRoot({ rootPath: frontendDist, exclude: ['/api/{*path}'] })]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    IncomeModule,
    CategoriesModule,
    ExpensesModule,
    DashboardModule,
    ImportModule,
    CategorizationModule,
    ...frontendModules,
  ],
})
export class AppModule {}
