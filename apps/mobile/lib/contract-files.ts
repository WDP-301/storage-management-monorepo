import type { PickedFile } from './uploads-api';

/** Matches the API cap on signed-contract files. */
export const MAX_CONTRACT_FILES = 10;
/** Matches the upload limit enforced when presigning. */
export const MAX_CONTRACT_FILE_BYTES = 15 * 1024 * 1024;

/** Splits picked files by the size limit, using the picker's size hint (unknown size passes). */
export function splitBySize(files: readonly PickedFile[]): {
  accepted: PickedFile[];
  tooLarge: PickedFile[];
} {
  const accepted: PickedFile[] = [];
  const tooLarge: PickedFile[] = [];
  for (const file of files) {
    (file.size !== undefined && file.size > MAX_CONTRACT_FILE_BYTES ? tooLarge : accepted).push(
      file,
    );
  }
  return { accepted, tooLarge };
}

/** Why the handover cannot be finalized yet, or `undefined` when nothing blocks it. */
export function handoverBlockedReason(documentCount: number, savingDocuments: boolean) {
  if (savingDocuments) return 'Đang lưu file hợp đồng…';
  if (documentCount === 0) return 'Cần tải file hợp đồng đã ký trước khi chốt.';
  return undefined;
}
