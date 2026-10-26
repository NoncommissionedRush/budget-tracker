import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadImportDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'camt.053/camt.052 XML, or a ZIP of them',
  })
  file?: unknown;

  @ApiPropertyOptional({
    description: 'Password for an encrypted ZIP file. Never stored.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}
