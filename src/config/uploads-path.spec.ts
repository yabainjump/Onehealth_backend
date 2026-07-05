import { join, resolve } from 'path';
import { resolveUploadsRoot } from './uploads-path';

describe('resolveUploadsRoot', () => {
  const initialUploadsDir = process.env.UPLOADS_DIR;

  afterEach(() => {
    if (initialUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = initialUploadsDir;
    }
  });

  it('uses UPLOADS_DIR when configured', () => {
    process.env.UPLOADS_DIR = './persistent-media';

    expect(resolveUploadsRoot()).toBe(resolve('./persistent-media'));
  });

  it('keeps the historical local folder as fallback', () => {
    delete process.env.UPLOADS_DIR;

    expect(resolveUploadsRoot()).toBe(join(process.cwd(), 'uploads'));
  });
});
