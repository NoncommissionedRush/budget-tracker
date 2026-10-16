export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  amount: string;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  allocatedAmount: string;
  activeMonths: number[]; // [] = active every month; [4,7,10,12] = specific months only
  sortOrder: number;
  isActive: boolean;
  isUnbudgeted: boolean;
  createdAt: string;
  updatedAt: string;
  subcategories: Subcategory[];
}

export interface CreateCategoryDto {
  name: string;
  icon?: string;
  color?: string;
  allocatedAmount?: number;
  isUnbudgeted?: boolean;
  activeMonths?: number[];
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  icon?: string;
  color?: string;
  allocatedAmount?: number;
  activeMonths?: number[];
}

export interface CreateSubcategoryDto {
  name: string;
  amount: number;
  sortOrder?: number;
}

export interface UpdateSubcategoryDto {
  name?: string;
  amount?: number;
}
