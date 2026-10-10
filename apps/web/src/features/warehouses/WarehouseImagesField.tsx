import { Button } from '@cloudflare/kumo';
import { Star, Trash, UploadSimple } from '@phosphor-icons/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { UploadsApi } from '../../lib/api';
import type { WarehouseImage } from '../../types/warehouse';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_WAREHOUSE_IMAGES,
  makeCover,
  validateNewImages,
} from './warehouse-images';

interface Props {
  images: WarehouseImage[];
  onChange: (images: WarehouseImage[]) => void;
  /** True while files are going up; the dialog must not save a half-built list. */
  onUploadingChange: (uploading: boolean) => void;
  onError: (message: string) => void;
}

/** Photos are uploaded on pick and only attached to the warehouse when the form is saved. */
export const WarehouseImagesField: React.FC<Props> = ({
  images,
  onChange,
  onUploadingChange,
  onError,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const full = images.length >= MAX_WAREHOUSE_IMAGES;

  const add = async (files: File[]) => {
    const problem = validateNewImages(images.length, files);
    if (problem) return onError(problem);
    setUploading(true);
    onUploadingChange(true);
    try {
      const added: WarehouseImage[] = [];
      for (const file of files) {
        const uploaded = await UploadsApi.upload(file);
        added.push({ ...uploaded, url: URL.createObjectURL(file) });
      }
      onChange([...images, ...added]);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Tải ảnh lên thất bại.');
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  };

  return (
    <section className="space-y-2">
      <span className="text-xs font-semibold text-kumo-default block">
        Hình ảnh kho ({images.length}/{MAX_WAREHOUSE_IMAGES})
      </span>
      {images.length === 0 && (
        <p className="text-sm text-kumo-subtle">Chưa có ảnh. Khách hàng sẽ thấy ảnh đầu tiên.</p>
      )}
      <ul className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <li key={image.fileKey} className="w-28 space-y-1">
            <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-kumo-line bg-kumo-control flex items-center justify-center">
              {image.url ? (
                <img src={image.url} alt={image.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-kumo-subtle px-1 break-all">{image.name}</span>
              )}
              {index === 0 && (
                <span className="absolute top-1 left-1 rounded bg-kumo-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Ảnh bìa
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {index > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  shape="square"
                  icon={<Star className="w-3.5 h-3.5" />}
                  aria-label={`Đặt ${image.name} làm ảnh bìa`}
                  title="Đặt làm ảnh bìa"
                  disabled={uploading}
                  onClick={() => onChange(makeCover(images, image.fileKey))}
                />
              )}
              <Button
                size="sm"
                variant="secondary"
                shape="square"
                icon={<Trash className="w-3.5 h-3.5" />}
                aria-label={`Xóa ảnh ${image.name}`}
                title="Xóa ảnh"
                disabled={uploading}
                onClick={() => onChange(images.filter((i) => i.fileKey !== image.fileKey))}
              />
            </div>
          </li>
        ))}
      </ul>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        aria-label="Chọn ảnh kho"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) void add(files);
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        icon={<UploadSimple className="w-3.5 h-3.5" />}
        loading={uploading}
        disabled={uploading || full}
        title={full ? `Đã đủ ${MAX_WAREHOUSE_IMAGES} ảnh` : undefined}
        onClick={() => fileInput.current?.click()}
      >
        Thêm ảnh
      </Button>
      <p className="text-xs text-kumo-subtle">
        JPG, PNG, WebP hoặc HEIC, mỗi ảnh ≤ 15 MB. Thay đổi được lưu khi bấm lưu kho.
      </p>
    </section>
  );
};
