import { ApiPropertyOptional } from '@nestjs/swagger';
import { RuleField, RuleMatchType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RuleConditionDto {
  @ApiPropertyOptional({ enum: RuleField, nullable: true })
  @IsEnum(RuleField)
  @IsOptional()
  field?: RuleField | null;

  @ApiPropertyOptional({ enum: RuleMatchType })
  @IsEnum(RuleMatchType)
  @IsOptional()
  matchType?: RuleMatchType;

  @ApiPropertyOptional({ example: 'SK0099000000000000000102', nullable: true })
  @IsString()
  @IsOptional()
  pattern?: string | null;

  @ApiPropertyOptional({ example: 50, nullable: true })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amountMin?: number | null;

  @ApiPropertyOptional({ example: 60, nullable: true })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  amountMax?: number | null;
}
