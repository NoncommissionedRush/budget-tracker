import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ImportService } from './import.service';
import { UploadImportDto } from './dto/upload-import.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('import')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('upload')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImportDto })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadImportDto,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importService.importUpload(
      file.originalname,
      file.buffer,
      dto.password || undefined,
    );
  }
}
