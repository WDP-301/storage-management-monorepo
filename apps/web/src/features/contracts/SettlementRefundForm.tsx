import { Button, Input } from '@cloudflare/kumo';
import { Trash, UploadSimple, WarningCircle } from '@phosphor-icons/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { SignedFileLink, SignedImageThumb } from '../../components/SignedFile';
import { UploadsApi } from '../../lib/api';
import { SettlementsApi } from '../../lib/settlements-api';
import type { EvidenceFile, SettlementDetailRecord } from '../../types/settlement';
import { ACCEPTED_DOCUMENT_TYPES } from './contract-display';
import {
  buildRefundInput,
  EMPTY_REFUND_PROOF,
  MAX_REFUND_EVIDENCE,
  MAX_TRANSFER_REF_LENGTH,
  validateProofFiles,
  validateRefundProof,
} from './refund-proof-form';
import { RefundTransferDetails } from './SettlementApprovalInfo';
import { describeApiError, isStaleSettlementError } from './settlement-display';
import { MAX_NOTE_LENGTH } from './settlement-form';

interface Props {
  /** AWAITING_REFUND settlement. */
  record: SettlementDetailRecord;
  onCompleted: (record: SettlementDetailRecord) => void;
  onStale: () => void;
}

/** What to transfer by hand, then the proof that it was sent. */
export const SettlementRefundForm: React.FC<Props> = ({ record, onCompleted, onStale }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState(EMPTY_REFUND_PROOF);
  const [busy, setBusy] = useState<'upload' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: File[]) => {
    const problem = validateProofFiles(proof.evidence.length, files);
    if (problem) return setError(problem);
    setBusy('upload');
    setError(null);
    try {
      const added: EvidenceFile[] = [];
      // One at a time: a failure stops early and keeps what was already uploaded.
      for (const file of files) added.push(await UploadsApi.upload(file));
      setProof((prev) => ({ ...prev, evidence: [...prev.evidence, ...added] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải chứng từ lên thất bại.');
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    const problem = validateRefundProof(proof);
    if (problem) return setError(problem);
    setBusy('submit');
    setError(null);
    try {
      onCompleted(await SettlementsApi.refundComplete(record.contract.id, buildRefundInput(proof)));
    } catch (err) {
      setError(describeApiError(err, 'Không xác nhận được chuyển khoản.'));
      if (isStaleSettlementError(err)) onStale();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <RefundTransferDetails record={record} />

      <section className="space-y-2">
        <span className="text-xs font-semibold text-kumo-default block">
          Ảnh chứng từ chuyển khoản — bắt buộc ({proof.evidence.length}/{MAX_REFUND_EVIDENCE})
        </span>
        <ul className="flex flex-wrap gap-2">
          {proof.evidence.map((file) => (
            <li key={file.fileKey} className="space-y-1">
              {file.mimeType.startsWith('image/') ? (
                <SignedImageThumb file={file} />
              ) : (
                <SignedFileLink file={file} />
              )}
              <Button
                size="sm"
                variant="secondary"
                icon={<Trash className="w-3.5 h-3.5" />}
                aria-label={`Bỏ chứng từ ${file.name}`}
                disabled={busy !== null}
                onClick={() =>
                  setProof((prev) => ({
                    ...prev,
                    evidence: prev.evidence.filter((f) => f.fileKey !== file.fileKey),
                  }))
                }
              >
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
          aria-label="Chọn ảnh chứng từ"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) void upload(files);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          icon={<UploadSimple className="w-3.5 h-3.5" />}
          loading={busy === 'upload'}
          disabled={busy !== null || proof.evidence.length >= MAX_REFUND_EVIDENCE}
          onClick={() => fileInput.current?.click()}
        >
          Đính kèm chứng từ
        </Button>
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          label="Mã giao dịch (tuỳ chọn)"
          value={proof.transferRef}
          maxLength={MAX_TRANSFER_REF_LENGTH}
          disabled={busy !== null}
          onChange={(e) => setProof((prev) => ({ ...prev, transferRef: e.target.value }))}
        />
        <Input
          label="Ghi chú (tuỳ chọn)"
          value={proof.note}
          maxLength={MAX_NOTE_LENGTH}
          disabled={busy !== null}
          onChange={(e) => setProof((prev) => ({ ...prev, note: e.target.value }))}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex gap-2"
        >
          <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          loading={busy === 'submit'}
          disabled={busy !== null}
          onClick={() => void submit()}
        >
          Xác nhận đã chuyển khoản
        </Button>
      </div>
    </div>
  );
};
