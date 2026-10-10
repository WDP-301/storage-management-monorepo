import { describe, expect, it } from 'vitest';
import { MAX_WAREHOUSE_IMAGES, makeCover, validateNewImages } from './warehouse-images';

const file = (name: string, type = 'image/jpeg', size = 1024) =>
  new File([new Uint8Array(size)], name, { type });

describe('warehouse images', () => {
  it('accepts photos within the limit', () => {
    expect(validateNewImages(0, [file('a.jpg'), file('b.png', 'image/png')])).toBeNull();
  });

  it('rejects non-images, empty files and going over the limit', () => {
    expect(validateNewImages(0, [file('a.pdf', 'application/pdf')])).toContain('không phải ảnh');
    expect(validateNewImages(0, [file('a.jpg', 'image/jpeg', 0)])).toContain('rỗng');
    expect(validateNewImages(MAX_WAREHOUSE_IMAGES, [file('a.jpg')])).toContain('tối đa');
  });

  it('moves the chosen photo to the front as the cover', () => {
    const images = ['1', '2', '3'].map((k) => ({ fileKey: k, name: k, mimeType: 'image/jpeg' }));
    expect(makeCover(images, '3').map((i) => i.fileKey)).toEqual(['3', '1', '2']);
  });
});
