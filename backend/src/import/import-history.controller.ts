import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImportHistoryService } from './import-history.service';
import { MailImportService } from './mail/mail-import.service';

@ApiTags('import')
@Controller('import')
export class ImportHistoryController {
  constructor(
    private readonly history: ImportHistoryService,
    private readonly mailImport: MailImportService,
  ) {}

  @Get('batches')
  @ApiOperation({ summary: 'Recent import batches with their current counts' })
  batches() {
    return this.history.batches();
  }

  @Post('batches/:id/recategorize')
  @HttpCode(200)
  @ApiOperation({
    summary: "Re-run categorization on a batch's unreviewed transactions",
  })
  recategorize(@Param('id') id: string) {
    return this.history.recategorize(id);
  }

  @Get('mail')
  @ApiOperation({
    summary: 'Mailbox import status and recently processed emails',
  })
  async mail() {
    return {
      status: this.mailImport.status(),
      messages: await this.history.mailMessages(),
    };
  }

  @Post('mail/check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Check the mailbox now' })
  check() {
    return this.mailImport.check();
  }

  @Post('mail/:id/rerun')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fetch one email again and re-import it' })
  rerun(@Param('id') id: string) {
    return this.mailImport.rerun(id);
  }
}
