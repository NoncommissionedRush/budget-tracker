import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ReorderRulesDto {
  @ApiProperty({ type: [String], example: ['id1', 'id2', 'id3'] })
  @IsArray()
  @IsString({ each: true })
  order: string[];
}
