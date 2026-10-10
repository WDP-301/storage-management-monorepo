import type { WarehouseImage } from '../../types/warehouse';

export const MAX_WAREHOUSE_IMAGES = 10;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/** Client-side pre-check so a bad pick never costs an upload; the API stays the authority. */
export function validateNewImages(existing: number, files: readonly File[]): string | null {
  if (existing + files.length > MAX_WAREHOUSE_IMAGES)
    return `Mỗi kho tối đa ${MAX_WAREHOUSE_IMAGES} ảnh (hiện có ${existing}).`;
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
      return `"${file.name}" không phải ảnh — chỉ nhận JPG, PNG, WebP, HEIC.`;
    if (file.size > MAX_IMAGE_BYTES) return `"${file.name}" vượt quá 15 MB.`;
    if (file.size === 0) return `"${file.name}" là file rỗng.`;
  }
  return null;
}

/** Moves the chosen photo to the front, where it becomes the cover. */
export function makeCover(images: readonly WarehouseImage[], fileKey: string): WarehouseImage[] {
  const chosen = images.find((image) => image.fileKey === fileKey);
  if (!chosen) return [...images];
  return [chosen, ...images.filter((image) => image.fileKey !== fileKey)];
}
