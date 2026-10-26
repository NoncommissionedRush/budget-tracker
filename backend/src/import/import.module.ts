import { Module } from '@nestjs/common';
import { CategorizationModule } from '../categorization/categorization.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { ImportHistoryController } from './import-history.controller';
import { ImportHistoryService } from './import-history.service';
import { MailImportService } from './mail/mail-import.service';
import { MAILBOX_FACTORY, openImapMailbox } from './mail/mailbox';

@Module({
  imports: [CategorizationModule],
  controllers: [ImportController, ImportHistoryController],
  providers: [
    ImportService,
    ImportHistoryService,
    MailImportService,
    { provide: MAILBOX_FACTORY, useValue: openImapMailbox },
  ],
  exports: [ImportService],
})
export class ImportModule {}
