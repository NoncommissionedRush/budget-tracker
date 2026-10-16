import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'cat-id-here' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ example: 'sub-id-here', description: 'Optional subcategory ID' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  subcategoryId?: string;

  @ApiProperty({ example: 45.50 })
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'Weekly groceries' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '2026-02-26' })
  @IsDateString()
  expenseDate: string;
}
