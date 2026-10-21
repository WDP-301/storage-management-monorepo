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
