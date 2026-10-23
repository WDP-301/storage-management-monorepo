import { Readable } from 'node:stream';
import { buildUploadKey, isOwnUpload, UploadService } from './upload.service';

describe('UploadService error contract', () => {
  const config = {
    get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
  };
  let service: UploadService;
  let send: jest.Mock;

  beforeEach(() => {
    config.get.mockClear();
    service = new UploadService(config as never);
    send = jest.fn();
    (service as unknown as { s3Client: { send: jest.Mock } }).s3Client = { send };
  });

  it('returns FILE_NOT_FOUND when the requested object does not exist', async () => {
    send.mockRejectedValue(Object.assign(new Error('missing'), { name: 'NoSuchKey' }));

    await expect(service.getFileStream('uploads/missing.txt')).rejects.toMatchObject({
      status: 404,
      response: { code: 'FILE_NOT_FOUND' },
    });
  });

  it('returns UPLOAD_FAILED without exposing storage errors', async () => {
    send.mockRejectedValue(new Error('vendor secret'));

    await expect(
      service.uploadBuffer('uploads/file.txt', Buffer.from('data'), 'text/plain'),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload file to S3 storage',
      },
    });
  });

  it('returns a readable stream when storage succeeds', async () => {
    const stream = Readable.from('data');
    send.mockResolvedValue({ Body: stream, ContentType: 'text/plain' });

    await expect(service.getFileStream('uploads/file.txt')).resolves.toEqual({
      stream,
      contentType: 'text/plain',
    });
  });

  it.each([['documents/id-card.png'], ['../escape.png'], ['uploads/../escape.png']])(
    'rejects keys outside uploads/: %s',
    async (fileKey) => {
      await expect(service.getFileStream(fileKey)).rejects.toMatchObject({
        status: 400,
        response: { code: 'VALIDATION_FAILED' },
      });
      await expect(service.generatePresignedDownloadUrl(fileKey)).rejects.toMatchObject({
        status: 400,
      });
      await expect(service.deleteFile(fileKey)).rejects.toMatchObject({ status: 400 });
      expect(send).not.toHaveBeenCalled();
    },
  );
});

describe('buildUploadKey', () => {
  const OWNER = '01a16948-56fa-7f68-bd82-16b640679a96';

  it('keeps keys under uploads/ with the owner, a sanitised name and an unguessable part', () => {
    const a = buildUploadKey('Hợp đồng ký.pdf', OWNER);
    const b = buildUploadKey('Hợp đồng ký.pdf', OWNER);
    expect(a).toMatch(new RegExp(`^uploads/${OWNER}-\\d+-[0-9a-f]{16}-H_p___ng_k_\\.pdf$`));
    expect(a).not.toBe(b);
  });

  it('tells whose upload a key is', () => {
    const key = buildUploadKey('a.jpg', OWNER);
    expect(isOwnUpload(key, OWNER)).toBe(true);
    expect(isOwnUpload(key, '01a16948-56fa-7f68-bd82-16b640679a97')).toBe(false);
    expect(isOwnUpload('uploads/1700000000000-abcd-a.jpg', OWNER)).toBe(false);
  });
});
