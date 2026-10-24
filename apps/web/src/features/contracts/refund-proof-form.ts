import type { CompleteRefundInput, EvidenceFile } from '../../types/settlement';
import { ACCEPTED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from './contract-display';
import { MAX_NOTE_LENGTH } from './settlement-form';

export const MAX_REFUND_EVIDENCE = 5;
export const MAX_TRANSFER_REF_LENGTH = 100;

export interface RefundProofState {
  evidence: EvidenceFile[];
  transferRef: string;
  note: string;
}

export const EMPTY_REFUND_PROOF: RefundProofState = { evidence: [], transferRef: '', note: '' };

/** Pre-check of picked files so a bad pick never costs an upload; the API stays the authority. */
export function validateProofFiles(existing: number, files: readonly File[]): string | null {
  if (existing + files.length > MAX_REFUND_EVIDENCE)
    return `Tối đa ${MAX_REFUND_EVIDENCE} ảnh chứng từ (hiện có ${existing}).`;
  for (const file of files) {
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type))
      return `"${file.name}" không đúng định dạng — chỉ nhận ảnh (JPG, PNG, WebP, HEIC) hoặc PDF.`;
    if (file.size > MAX_DOCUMENT_BYTES) return `"${file.name}" vượt quá 15 MB.`;
    if (file.size === 0) return `"${file.name}" là file rỗng.`;
  }
  return null;
}

/** The transfer needs proof: at least one evidence file; the bank reference is optional. */
export function validateRefundProof(state: RefundProofState): string | null {
  const ref = state.transferRef.trim();
  if (state.evidence.length === 0) return 'Đính kèm ít nhất 1 ảnh chứng từ chuyển khoản.';
  if (state.evidence.length > MAX_REFUND_EVIDENCE)
    return `Tối đa ${MAX_REFUND_EVIDENCE} ảnh chứng từ.`;
  if (ref.length > MAX_TRANSFER_REF_LENGTH)
    return `Mã giao dịch tối đa ${MAX_TRANSFER_REF_LENGTH} ký tự.`;
  if (state.note.trim().length > MAX_NOTE_LENGTH) return `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự.`;
  return null;
}

export function buildRefundInput(state: RefundProofState): CompleteRefundInput {
  const input: CompleteRefundInput = { evidence: state.evidence };
  const ref = state.transferRef.trim();
  if (ref) input.transferRef = ref;
  const note = state.note.trim();
  if (note) input.note = note;
  return input;
}
