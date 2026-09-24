import { Readable } from 'node:stream';
import { UploadService } from './upload.service';

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

    await expect(service.getFileStream('missing.txt')).rejects.toMatchObject({
      status: 404,
      response: { code: 'FILE_NOT_FOUND' },
    });
  });

  it('returns UPLOAD_FAILED without exposing storage errors', async () => {
    send.mockRejectedValue(new Error('vendor secret'));

    await expect(
      service.uploadBuffer('file.txt', Buffer.from('data'), 'text/plain'),
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

    await expect(service.getFileStream('file.txt')).resolves.toEqual({
      stream,
      contentType: 'text/plain',
    });
  });
});
