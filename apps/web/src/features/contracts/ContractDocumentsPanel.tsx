import { Button } from '@cloudflare/kumo';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { SignedFileLink, SignedImageThumb } from '../../components/SignedFile';
import { useImageLightbox } from '../../components/SignedImageLightbox';
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
  const [dragging, setDragging] = useState(false);
  // Photographed pages open in a viewer that steps through every image of the contract.
  const viewer = useImageLightbox(documents);
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
      <span className="text-lg font-semibold text-kumo-default block">
        File hợp đồng ({documents.length})
      </span>
      {documents.length === 0 && <p className="text-sm text-kumo-subtle">Chưa có file hợp đồng.</p>}
      <ul className="flex flex-wrap gap-2">
        {documents.map((doc) => (
          <li key={doc.fileKey} className="space-y-1">
            {doc.mimeType.startsWith('image/') ? (
              <SignedImageThumb file={doc} onOpen={() => viewer.open(doc)} />
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

      {viewer.lightbox}

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
          <button
            type="button"
            aria-label="Tải file lên"
            disabled={busy || full}
            title={full ? `Đã đủ ${MAX_CONTRACT_DOCUMENTS} file` : undefined}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              add(Array.from(e.dataTransfer.files));
            }}
            className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              dragging
                ? 'border-kumo-brand bg-kumo-control'
                : 'border-kumo-line bg-kumo-control/60 hover:bg-kumo-control'
            }`}
          >
            <UploadSimple className="w-5 h-5 text-kumo-brand" />
            <span className="text-sm font-medium text-kumo-default">
              {busy ? 'Đang tải lên…' : 'Tải file lên'}
              {!busy && <span className="font-normal text-kumo-subtle"> hoặc kéo thả vào đây</span>}
            </span>
            <span className="text-xs text-kumo-subtle">
              Ảnh chụp từng trang hoặc PDF, tối đa {MAX_CONTRACT_DOCUMENTS} file, mỗi file ≤ 15 MB.
            </span>
          </button>
        </>
      )}
    </section>
  );
};
