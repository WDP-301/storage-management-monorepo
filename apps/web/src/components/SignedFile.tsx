import { Paperclip } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { UploadsApi } from '../lib/api';

export interface FileRef {
  name: string;
  /** Private-bucket key — resolved to a presigned URL on demand. */
  fileKey?: string;
  /** Legacy rows stored a direct URL instead of a key. */
  url?: string;
  mimeType?: string;
  size?: number;
}

const formatFileSize = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Presigned links expire, so each click asks for a fresh one. The tab is opened before the
 * request resolves — a `window.open` after an await would be eaten by the popup blocker.
 */
/**
 * Legacy attachment URLs are customer-supplied: only http(s) may be opened, never
 * `javascript:`/`data:` (window.open does not get React's href sanitising).
 */
export function safeHttpUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

async function openFile(file: FileRef): Promise<void> {
  if (!file.fileKey) {
    const url = safeHttpUrl(file.url);
    if (url) window.open(url, '_blank', 'noopener');
    return;
  }
  const tab = window.open('', '_blank');
  try {
    const url = await UploadsApi.downloadUrl(file.fileKey);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch {
    tab?.close();
  }
}

export const SignedFileLink: React.FC<{ file: FileRef }> = ({ file }) => {
  const canOpen = Boolean(file.fileKey || safeHttpUrl(file.url));
  return (
    <div className="flex items-center gap-2 p-2.5 bg-kumo-control rounded-lg border border-kumo-line text-xs">
      <Paperclip className="w-3.5 h-3.5 text-kumo-subtle shrink-0" />
      {canOpen ? (
        <button
          type="button"
          onClick={() => void openFile(file)}
          className="font-medium text-kumo-brand hover:underline truncate cursor-pointer text-left"
        >
          {file.name}
        </button>
      ) : (
        <span className="font-medium text-kumo-default truncate">{file.name}</span>
      )}
      {file.size != null && (
        <span className="ml-auto text-kumo-subtle shrink-0">{formatFileSize(file.size)}</span>
      )}
    </div>
  );
};

/** Image thumbnail from the private bucket; falls back to the file name if it cannot load. */
export const SignedImageThumb: React.FC<{ file: FileRef }> = ({ file }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    if (!file.fileKey) return;
    UploadsApi.downloadUrl(file.fileKey)
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [file.fileKey]);

  return (
    <button
      type="button"
      title={file.name}
      onClick={() => void openFile(file)}
      className="w-24 h-24 rounded-lg overflow-hidden border border-kumo-line bg-kumo-control cursor-pointer flex items-center justify-center"
    >
      {src && !failed ? (
        <img
          src={src}
          alt={file.name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[10px] text-kumo-subtle px-1 break-all line-clamp-3">
          {file.name}
        </span>
      )}
    </button>
  );
};
