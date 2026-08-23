import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { ensureUploadsRootReady, resolveUploadsRoot } from './uploads-path';

describe('resolveUploadsRoot', () => {
  const initialUploadsDir = process.env.UPLOADS_DIR;
  const initialNodeEnv = process.env.NODE_ENV;
  const temporaryPaths: string[] = [];

  afterEach(() => {
    if (initialUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = initialUploadsDir;
    }
    if (initialNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = initialNodeEnv;
    }
    for (const path of temporaryPaths.splice(0)) {
      rmSync(path, { recursive: true, force: true });
    }
  });

  it('uses UPLOADS_DIR when configured', () => {
    process.env.UPLOADS_DIR = './persistent-media';

    expect(resolveUploadsRoot()).toBe(resolve('./persistent-media'));
  });

  it('keeps the historical local folder as fallback', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.UPLOADS_DIR;

    expect(resolveUploadsRoot()).toBe(join(process.cwd(), 'uploads'));
  });

  it('requires one explicit absolute shared root in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.UPLOADS_DIR = './worker-local-media';

    expect(() => resolveUploadsRoot()).toThrow(/absolute/i);
  });

  it('creates and validates the shared writable directory before traffic', () => {
    const base = mkdtempSync(join(tmpdir(), 'onehealth-media-'));
    temporaryPaths.push(base);
    process.env.NODE_ENV = 'production';
    process.env.UPLOADS_DIR = join(base, 'shared-uploads');

    const first = ensureUploadsRootReady();
    const second = ensureUploadsRootReady();

    expect(first).toBe(second);
    expect(isAbsolute(first)).toBe(true);
  });

  it('rejects a file masquerading as the shared upload directory', () => {
    const base = mkdtempSync(join(tmpdir(), 'onehealth-media-file-'));
    temporaryPaths.push(base);
    const file = join(base, 'uploads');
    writeFileSync(file, 'not-a-directory');
    process.env.NODE_ENV = 'production';
    process.env.UPLOADS_DIR = file;

    expect(() => ensureUploadsRootReady()).toThrow(/directory/i);
  });
});
