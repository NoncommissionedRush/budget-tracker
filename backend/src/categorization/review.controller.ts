import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import {
  CategorizeTransactionDto,
  IgnoreTransactionDto,
} from './dto/review-decision.dto';

@ApiTags('review')
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  @ApiOperation({ summary: 'Imported transactions waiting for a category' })
  findPending() {
    return this.reviewService.findPending();
  }

  @Post(':id/categorize')
  @HttpCode(200)
  @ApiOperation({ summary: 'Assign a category, optionally creating a rule' })
  categorize(@Param('id') id: string, @Body() dto: CategorizeTransactionDto) {
    return this.reviewService.categorize(id, dto);
  }

  @Post(':id/ignore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ignore a transaction, optionally creating a rule' })
  ignore(@Param('id') id: string, @Body() dto: IgnoreTransactionDto) {
    return this.reviewService.ignore(id, dto);
  }
}
