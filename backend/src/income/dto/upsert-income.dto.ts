import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Max, Min } from 'class-validator';

export class UpsertIncomeDto {
  @ApiProperty({ example: 3600.00, description: 'Monthly income amount in EUR' })
  @IsPositive()
  monthlyAmount: number;

  @ApiProperty({ example: 10, description: 'Day of month income arrives (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  incomeDay: number;
}
