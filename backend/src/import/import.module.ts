import { Module } from '@nestjs/common';
import { CategorizationModule } from '../categorization/categorization.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [CategorizationModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
