import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class DashboardQueryDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({ example: 2, description: '1-12' })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;
}

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard data for a period' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getDashboard(query.year, query.month);
  }
}
