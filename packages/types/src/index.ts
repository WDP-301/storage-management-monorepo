export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const StorageItemStatus = {
  IN_STOCK: 'IN_STOCK',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  DISCONTINUED: 'DISCONTINUED',
} as const;

export type StorageItemStatus = (typeof StorageItemStatus)[keyof typeof StorageItemStatus];

export interface IStorageLocation {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  address?: string | null;
  capacity?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IStorageItem {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  quantity: number;
  minQuantity: number;
  unit: string;
  price: number;
  status: StorageItemStatus;
  imageUrl?: string | null;
  locationId?: string | null;
  location?: IStorageLocation | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface StorageDashboardSummary {
  totalLocations: number;
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface PresignedUploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export interface UploadedFileResponse {
  key: string;
  bucket: string;
  url: string;
  size: number;
  mimeType: string;
}
export * from './mock-data';
export * from './self-storage';
