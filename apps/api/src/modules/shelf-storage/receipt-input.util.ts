import { isOwnUpload } from '@modules/upload/upload.service';
import { fieldValidationError } from '@shared/exceptions/domain.exception';
import {
  type CreateShelfReceiptInput,
  type CreateShelfRecoveryInput,
  type EvidenceFile,
  ShelfReceiptType,
} from '@storage/types';
import { itemNameKey, normalizeItemName } from './shelf-rules';

/** A receipt line after validation: a known item, or a name (name is already normalized). */
export interface NormalizedLine {
  itemId?: string;
  name?: string;
  quantity: number;
}

const MAX_NAME_LENGTH = 120;
const MAX_QUANTITY = 10_000;

const lineError = (index: number, message: string) =>
  fieldValidationError(`lines[${index}]`, 'lineShape', message);

/**
 * Checks each line's shape and rejects repeats. A drop-off line names exactly one of an existing
 * item or a (possibly new) name; a pick-up line can only take an existing item.
 */
function normalizeLines(
  lines: CreateShelfReceiptInput['lines'],
  type: ShelfReceiptType,
): NormalizedLine[] {
  const seen = new Set<string>();
  return lines.map((line, index) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      throw lineError(index, `Số lượng phải là số nguyên từ 1 đến ${MAX_QUANTITY}`);
    }
    const hasId = line.itemId !== undefined && line.itemId !== null;
    const hasName = line.name !== undefined && line.name !== null;
    if (type === ShelfReceiptType.PICK_UP ? !hasId || hasName : hasId === hasName) {
      throw lineError(
        index,
        type === ShelfReceiptType.PICK_UP
          ? 'Phiếu lấy đồ chỉ chọn món đang có trên kệ'
          : 'Mỗi dòng chỉ chọn món đã có hoặc nhập tên món',
      );
    }
    let key: string;
    let normalized: NormalizedLine;
    if (hasName) {
      const name = normalizeItemName(line.name as string);
      if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
        throw lineError(index, `Tên món phải từ 1 đến ${MAX_NAME_LENGTH} ký tự`);
      }
      key = `name:${itemNameKey(name)}`;
      normalized = { name, quantity: line.quantity };
    } else {
      key = `id:${line.itemId}`;
      normalized = { itemId: line.itemId, quantity: line.quantity };
    }
    if (seen.has(key)) {
      throw fieldValidationError(`lines[${index}]`, 'duplicateLine', 'Món này đã có ở dòng trước');
    }
    seen.add(key);
    return normalized;
  });
}

/** Photos become readable by the customer, so staff may only attach files they uploaded. */
function assertPhotos(photos: EvidenceFile[], actorId: string, required: boolean): void {
  if (required && photos.length === 0) {
    throw fieldValidationError('photos', 'required', 'Cần ít nhất 1 ảnh');
  }
  if (photos.some((photo) => !isOwnUpload(photo.fileKey, actorId))) {
    throw fieldValidationError('photos', 'notOwnUpload', 'Chỉ đính kèm được tệp bạn đã tải lên');
  }
}

/** Shape rules of a counter receipt; throws VALIDATION_FAILED (400) and returns the lines. */
export function validateReceiptShape(
  input: Pick<CreateShelfReceiptInput, 'type' | 'lines' | 'photos' | 'pickupRequestId'>,
  actorId: string,
): NormalizedLine[] {
  const lines = normalizeLines(input.lines, input.type);
  assertPhotos(input.photos ?? [], actorId, input.type === ShelfReceiptType.DROP_OFF);
  if (input.type === ShelfReceiptType.DROP_OFF && input.pickupRequestId) {
    throw fieldValidationError(
      'pickupRequestId',
      'notAllowed',
      'Chỉ phiếu lấy đồ mới gắn được yêu cầu lấy đồ',
    );
  }
  return lines;
}

/** Shape rules of a scan-less recovery: a pick-up by item with at least one photo. */
export function validateRecoveryShape(
  input: Pick<CreateShelfRecoveryInput, 'lines' | 'photos'>,
  actorId: string,
): NormalizedLine[] {
  const lines = normalizeLines(input.lines, ShelfReceiptType.PICK_UP);
  assertPhotos(input.photos, actorId, true);
  return lines;
}
