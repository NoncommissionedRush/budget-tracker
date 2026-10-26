import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RulesService } from './rules.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { ReorderRulesDto } from './dto/reorder-rules.dto';

@ApiTags('rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @ApiOperation({ summary: 'List categorization rules in priority order' })
  findAll() {
    return this.rulesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a rule (added with the lowest priority)' })
  create(@Body() dto: CreateRuleDto) {
    return this.rulesService.create(dto);
  }

  @Post('apply')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run categorization over transactions waiting for review',
  })
  apply() {
    return this.rulesService.apply();
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Set rule priority order' })
  reorder(@Body() dto: ReorderRulesDto) {
    return this.rulesService.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rule' })
  update(@Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.rulesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a rule' })
  remove(@Param('id') id: string) {
    return this.rulesService.remove(id);
  }
}
