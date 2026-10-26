import { Module } from '@nestjs/common';
import { CategorizationService } from './categorization.service';
import { RulesService } from './rules.service';
import { ReviewService } from './review.service';
import { RulesController } from './rules.controller';
import { ReviewController } from './review.controller';

@Module({
  controllers: [RulesController, ReviewController],
  providers: [CategorizationService, RulesService, ReviewService],
  exports: [CategorizationService],
})
export class CategorizationModule {}
