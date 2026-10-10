import * as FileSystem from 'expo-file-system/legacy';
import type { TicketAttachment } from '../src/types/ticket-api';
import { ApiError, request } from './api';

type PresignedUploadUrlResponse = {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
};

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  /** The picker's size hint; the real size is read from the filesystem before presigning. */
  size?: number;
};

export const UploadsApi = {
  /**
   * Presigns via the API then PUTs the bytes straight to S3 — the server signs `fileSize`
   * into the URL, so the declared size must equal the real byte count or S3 rejects the PUT.
   */
  uploadFile: async (file: PickedFile): Promise<TicketAttachment> => {
    // Measure the file on disk: the picker's `fileSize` can describe the original image rather
    // than the re-compressed copy (quality < 1), and a mismatch makes S3 reject the signed PUT.
    const info = await FileSystem.getInfoAsync(file.uri);
    const size = info.exists && info.size > 0 ? info.size : (file.size ?? 0);
    if (!size) {
      throw new ApiError('Không đọc được kích thước tệp.');
    }

    const presigned = await request<PresignedUploadUrlResponse>('/uploads/presigned-url', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, mimeType: file.mimeType, fileSize: size }),
    });

    const upload = await FileSystem.uploadAsync(presigned.uploadUrl, file.uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': file.mimeType },
    });
    if (upload.status < 200 || upload.status >= 300) {
      throw new ApiError('Tải tệp lên thất bại. Thử lại sau.', upload.status);
    }

    return { fileKey: presigned.fileKey, name: file.name, mimeType: file.mimeType, size };
  },

  downloadUrl: (fileKey: string, signal?: AbortSignal) =>
    request<{ downloadUrl: string }>(
      `/uploads/download-url?fileKey=${encodeURIComponent(fileKey)}`,
      { signal },
    ),
};
