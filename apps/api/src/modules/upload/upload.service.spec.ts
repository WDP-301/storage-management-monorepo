import { Readable } from 'node:stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { validate } from 'class-validator';
import { GetPresignedUrlDto } from './dto/upload.dto';
import { buildUploadKey, isOwnUpload, UploadService } from './upload.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/obj'),
}));

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

  it('falls back to endpoint/bucket when S3_PUBLIC_URL is blank string', async () => {
    const blankPublicUrlConfig = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'S3_ENDPOINT') return 'https://s3.example.com';
        if (key === 'S3_BUCKET') return 'my-bucket';
        if (key === 'S3_PUBLIC_URL') return '   ';
        return defaultValue;
      }),
    };
    const svc = new UploadService(blankPublicUrlConfig as never);
    (svc as unknown as { s3Client: { send: jest.Mock } }).s3Client = { send: jest.fn() };

    const res = await svc.uploadBuffer('uploads/a.png', Buffer.from('x'), 'image/png');
    expect(res.publicUrl).toBe('https://s3.example.com/my-bucket/uploads/a.png');
  });

  it('signs download URLs with Content-Disposition attachment', async () => {
    const url = await service.generatePresignedDownloadUrl('uploads/1-doc.pdf');

    expect(url).toBe('https://signed.example/obj');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'storage-management-bucket',
          Key: 'uploads/1-doc.pdf',
          ResponseContentDisposition: 'attachment; filename="1-doc.pdf"',
        }),
      }),
      { expiresIn: 3600 },
    );
  });

  it('rejects active scriptable MIME types in GetPresignedUrlDto', async () => {
    const svg = Object.assign(new GetPresignedUrlDto(), {
      fileName: 'evil.svg',
      mimeType: 'image/svg+xml',
      fileSize: 120,
    });
    const html = Object.assign(new GetPresignedUrlDto(), {
      fileName: 'evil.html',
      mimeType: 'text/html',
      fileSize: 120,
    });
    const jpg = Object.assign(new GetPresignedUrlDto(), {
      fileName: 'ok.jpg',
      mimeType: 'image/jpeg',
      fileSize: 120,
    });

    expect((await validate(svg)).length).toBeGreaterThan(0);
    expect((await validate(html)).length).toBeGreaterThan(0);
    expect(await validate(jpg)).toEqual([]);
  });
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
