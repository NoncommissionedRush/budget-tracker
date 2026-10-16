import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IncomeService } from './income.service';
import { UpsertIncomeDto } from './dto/upsert-income.dto';

@ApiTags('income')
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get()
  @ApiOperation({ summary: 'Get income configuration' })
  getIncomeConfig() {
    return this.incomeService.getIncomeConfig();
  }

  @Put()
  @ApiOperation({ summary: 'Create or update income configuration' })
  upsertIncomeConfig(@Body() dto: UpsertIncomeDto) {
    return this.incomeService.upsertIncomeConfig(dto);
  }
}
