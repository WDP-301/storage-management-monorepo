import { Button } from '@cloudflare/kumo';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { SignedFileLink, SignedImageThumb } from '../../components/SignedFile';
import { UploadsApi } from '../../lib/api';
import type { ContractDocument } from '../../types/contract';
import {
  ACCEPTED_DOCUMENT_TYPES,
  MAX_CONTRACT_DOCUMENTS,
  validateNewDocuments,
} from './contract-display';

interface Props {
  documents: ContractDocument[];
  /** Role may edit and the contract is still DRAFT or ACTIVE. */
  canEdit: boolean;
  /** ACTIVE contracts must always keep at least one file. */
  keepOne: boolean;
  /** Any action on the dialog is in flight; the panel locks while true. */
  busy: boolean;
  /** Runs `build` then stores the list it returns; the old list stays on failure. */
  onSave: (build: () => Promise<ContractDocument[]>) => void;
  onInvalid: (message: string) => void;
}

export const ContractDocumentsPanel: React.FC<Props> = ({
  documents,
  canEdit,
  keepOne,
  busy,
  onSave,
  onInvalid,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const full = documents.length >= MAX_CONTRACT_DOCUMENTS;
  const lastLocked = keepOne && documents.length <= 1;

  const add = (files: File[]) => {
    const problem = validateNewDocuments(documents.length, files);
    if (problem) return onInvalid(problem);
    onSave(async () => {
      const added: ContractDocument[] = [];
      // One at a time: a failure stops early and nothing is stored.
      for (const file of files) added.push(await UploadsApi.upload(file));
      return [...documents, ...added];
    });
  };

  const remove = (fileKey: string) => {
    setRemoving(null);
    onSave(async () => documents.filter((doc) => doc.fileKey !== fileKey));
  };

  return (
    <section className="space-y-2">
      <span className="text-xs font-semibold text-kumo-default block">
        File hợp đồng ({documents.length})
      </span>
      {documents.length === 0 && <p className="text-sm text-kumo-subtle">Chưa có file hợp đồng.</p>}
      <ul className="flex flex-wrap gap-2">
        {documents.map((doc) => (
          <li key={doc.fileKey} className="space-y-1">
            {doc.mimeType.startsWith('image/') ? (
              <SignedImageThumb file={doc} />
            ) : (
              <SignedFileLink file={doc} />
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Trash className="w-3.5 h-3.5" />}
                aria-label={`Xóa file ${doc.name}`}
                disabled={busy || lastLocked}
                onClick={() => setRemoving(doc.fileKey)}
              >
                Xóa
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && lastLocked && documents.length > 0 && (
        <p className="text-xs text-kumo-subtle">
          Hợp đồng đang hiệu lực phải có ít nhất 1 file — tải file mới lên trước khi xóa file này.
        </p>
      )}

      {removing && (
        <div className="p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
          <p className="text-kumo-default">Xóa file này khỏi hợp đồng? Không hoàn tác được.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>
              Quay lại
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => remove(removing)}>
              Xác nhận xóa file
            </Button>
          </div>
        </div>
      )}

      {canEdit && (
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
            aria-label="Chọn file hợp đồng"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length > 0) add(files);
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            icon={<UploadSimple className="w-3.5 h-3.5" />}
            loading={busy}
            disabled={busy || full}
            title={full ? `Đã đủ ${MAX_CONTRACT_DOCUMENTS} file` : undefined}
            onClick={() => fileInput.current?.click()}
          >
            Tải file lên
          </Button>
          <p className="text-xs text-kumo-subtle">
            Ảnh chụp từng trang hoặc PDF, tối đa {MAX_CONTRACT_DOCUMENTS} file, mỗi file ≤ 15 MB.
          </p>
        </>
      )}
    </section>
  );
};
