import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { RuleConditionDto } from './rule-condition.dto';

export class IgnoreTransactionDto {
  @ApiPropertyOptional({
    type: RuleConditionDto,
    description:
      '"Always do this": also create a rule that applies the same decision to matching transactions',
  })
  @ValidateNested()
  @Type(() => RuleConditionDto)
  @IsOptional()
  rule?: RuleConditionDto;
}

export class CategorizeTransactionDto extends IgnoreTransactionDto {
  @ApiProperty({ example: 'cat-id-here' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ example: 'sub-id-here' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  subcategoryId?: string;
}
