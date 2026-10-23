import { UploadController } from './upload.controller';

describe('UploadController.deleteFile', () => {
  const KEY = 'uploads/1-a.jpg';
  const setup = (rows: unknown[]) => {
    const uploads = { deleteFile: jest.fn(async (key: string) => ({ key, deleted: true })) };
    const query = jest.fn(async () => rows);
    const controller = new UploadController(uploads as never, { manager: { query } } as never);
    return { controller, uploads, query };
  };

  it('deletes a file nothing finalized refers to', async () => {
    const { controller, uploads, query } = setup([]);
    await expect(controller.deleteFile({ key: KEY })).resolves.toEqual({ key: KEY, deleted: true });
    expect(query).toHaveBeenCalled();
    expect(uploads.deleteFile).toHaveBeenCalledWith(KEY);
  });

  it('keeps evidence in the bucket (409 FILE_IN_USE)', async () => {
    const { controller, uploads } = setup([{}]);
    await expect(controller.deleteFile({ key: KEY })).rejects.toMatchObject({
      status: 409,
      response: { code: 'FILE_IN_USE' },
    });
    expect(uploads.deleteFile).not.toHaveBeenCalled();
  });
});

describe('UploadController reads', () => {
  const KEY = 'uploads/1-a.html';
  const customer = { id: 'cust-1', roles: ['CUSTOMER'] } as never;
  const setup = (rows: unknown[]) => {
    const stream = { pipe: jest.fn() };
    const uploads = {
      generatePresignedDownloadUrl: jest.fn(async () => 'https://bucket/signed'),
      getFileStream: jest.fn(async () => ({ stream, contentType: 'text/html' })),
    };
    const query = jest.fn(async () => rows);
    const controller = new UploadController(uploads as never, { manager: { query } } as never);
    return { controller, uploads, stream };
  };

  it("refuses a customer a download link for a file that isn't theirs", async () => {
    const { controller, uploads } = setup([]);
    await expect(controller.getDownloadUrl({ fileKey: KEY }, customer)).rejects.toMatchObject({
      status: 403,
    });
    expect(uploads.generatePresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('gives a customer a download link for their own file', async () => {
    const { controller } = setup([{}]);
    await expect(controller.getDownloadUrl({ fileKey: KEY }, customer)).resolves.toEqual({
      downloadUrl: 'https://bucket/signed',
    });
  });

  it('streams a file as a download the browser cannot render', async () => {
    const { controller, stream } = setup([{}]);
    const headers: Record<string, string> = {};
    const res = { setHeader: jest.fn((name: string, value: string) => (headers[name] = value)) };

    await controller.streamFile(['uploads', '1-a.html'], customer, res as never);

    expect(headers['Content-Type']).toBe('text/html');
    expect(headers['Content-Disposition']).toBe('attachment; filename="1-a.html"');
    expect(headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox");
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(stream.pipe).toHaveBeenCalledWith(res);
  });

  it("refuses to stream a file that isn't the customer's", async () => {
    const { controller, uploads } = setup([]);
    const res = { setHeader: jest.fn() };
    await expect(controller.streamFile(KEY, customer, res as never)).rejects.toMatchObject({
      status: 403,
    });
    expect(uploads.getFileStream).not.toHaveBeenCalled();
  });
});
