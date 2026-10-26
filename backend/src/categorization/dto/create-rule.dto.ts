import { ApiPropertyOptional } from '@nestjs/swagger';
import { RuleAction } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RuleConditionDto } from './rule-condition.dto';

export class CreateRuleDto extends RuleConditionDto {
  @ApiPropertyOptional({ enum: RuleAction })
  @IsEnum(RuleAction)
  @IsOptional()
  action?: RuleAction;

  @ApiPropertyOptional({ example: 'cat-id-here', nullable: true })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: 'sub-id-here', nullable: true })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  subcategoryId?: string | null;
}
