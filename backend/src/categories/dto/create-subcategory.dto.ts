import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateSubcategoryDto {
  @ApiProperty({ example: 'YouTube Premium' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 16.99 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
