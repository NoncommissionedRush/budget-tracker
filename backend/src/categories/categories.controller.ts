import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active categories with subcategories' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder categories' })
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.categoriesService.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a category' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  // ─── Subcategory routes ─────────────────────────────────────────────────────

  @Post(':id/subcategories')
  @ApiOperation({ summary: 'Add a subcategory to a category' })
  createSubcategory(
    @Param('id') categoryId: string,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.categoriesService.createSubcategory(categoryId, dto);
  }

  @Patch(':id/subcategories/:subId')
  @ApiOperation({ summary: 'Update a subcategory' })
  updateSubcategory(
    @Param('id') categoryId: string,
    @Param('subId') subId: string,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.categoriesService.updateSubcategory(categoryId, subId, dto);
  }

  @Delete(':id/subcategories/:subId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a subcategory (returns updated category)' })
  removeSubcategory(
    @Param('id') categoryId: string,
    @Param('subId') subId: string,
  ) {
    return this.categoriesService.removeSubcategory(categoryId, subId);
  }
}
