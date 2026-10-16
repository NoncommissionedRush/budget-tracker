import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { BudgetStateService } from './budget-state.service';
import { Category, CreateCategoryDto, UpdateCategoryDto, CreateSubcategoryDto, UpdateSubcategoryDto } from '../core/models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly state = inject(BudgetStateService);

  loadCategories() {
    return this.http
      .get<Category[]>(`${environment.apiUrl}/categories`)
      .pipe(tap((cats) => this.state.setCategories(cats)));
  }

  createCategory(dto: CreateCategoryDto) {
    return this.http
      .post<Category>(`${environment.apiUrl}/categories`, dto)
      .pipe(tap((cat) => this.state.addCategory(cat)));
  }

  updateCategory(id: string, dto: UpdateCategoryDto) {
    return this.http
      .patch<Category>(`${environment.apiUrl}/categories/${id}`, dto)
      .pipe(tap((cat) => this.state.updateCategory(cat)));
  }

  deleteCategory(id: string) {
    return this.http
      .delete<void>(`${environment.apiUrl}/categories/${id}`)
      .pipe(tap(() => this.state.removeCategory(id)));
  }

  reorderCategories(order: string[]) {
    return this.http
      .patch<Category[]>(`${environment.apiUrl}/categories/reorder`, { order })
      .pipe(tap((cats) => this.state.setCategories(cats)));
  }

  createSubcategory(categoryId: string, dto: CreateSubcategoryDto) {
    return this.http
      .post<Category>(`${environment.apiUrl}/categories/${categoryId}/subcategories`, dto)
      .pipe(tap((cat) => this.state.updateCategory(cat)));
  }

  updateSubcategory(categoryId: string, subId: string, dto: UpdateSubcategoryDto) {
    return this.http
      .patch<Category>(`${environment.apiUrl}/categories/${categoryId}/subcategories/${subId}`, dto)
      .pipe(tap((cat) => this.state.updateCategory(cat)));
  }

  deleteSubcategory(categoryId: string, subId: string) {
    return this.http
      .delete<Category>(`${environment.apiUrl}/categories/${categoryId}/subcategories/${subId}`)
      .pipe(tap((cat) => this.state.updateCategory(cat)));
  }
}
