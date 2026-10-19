/** A catalog entry managed by ADMIN; `code` never changes once created. */
export interface Amenity {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AmenityInput {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface AmenityUpdate {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** An amenity attached to a warehouse; retired amenities stay visible on warehouses carrying them. */
export interface WarehouseAmenity {
  amenityId: string;
  code: string;
  name: string;
  quantity: number;
  note: string | null;
  /** False when the catalog entry was retired but is still attached to the warehouse. */
  isActive: boolean;
}

export interface WarehouseAmenityInput {
  amenityId: string;
  quantity: number;
  note?: string | null;
}
