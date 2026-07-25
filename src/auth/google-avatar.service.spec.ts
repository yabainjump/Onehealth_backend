import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { GoogleAvatarService } from './google-avatar.service';

describe('GoogleAvatarService', () => {
  let uploadsDirectory: string;
  let service: GoogleAvatarService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const initialUploadsDirectory = process.env.UPLOADS_DIR;

  beforeEach(async () => {
    uploadsDirectory = await fs.mkdtemp(join(tmpdir(), 'onehealth-avatar-'));
    process.env.UPLOADS_DIR = uploadsDirectory;
    service = new GoogleAvatarService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
    if (initialUploadsDirectory === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = initialUploadsDirectory;
    }
    await fs.rm(uploadsDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  });

  it('downloads, validates and stores a Google avatar as a local WebP', async () => {
    const sourceImage = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: '#16845b',
      },
    })
      .png()
      .toBuffer();
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array(sourceImage), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': `${sourceImage.length}`,
        },
      }),
    );

    const result = await service.mirror(
      'https://lh3.googleusercontent.com/a/avatar',
      'google-user-1',
    );

    expect(result.photoURL).toMatch(
      /^\/uploads\/profile\/google-[a-f0-9]{24}-[a-f0-9]{16}\.webp$/,
    );
    const savedPath = join(
      uploadsDirectory,
      result.photoURL.replace('/uploads/', ''),
    );
    const savedImage = await fs.readFile(savedPath);
    const metadata = await sharp(savedImage).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    await expect(
      service.isManagedAvatarAvailable(result.photoURL, 'google-user-1'),
    ).resolves.toBe(true);
  });

  it('rejects non-Google URLs before making a request', async () => {
    await expect(
      service.mirror('https://example.com/avatar.png', 'google-user-1'),
    ).rejects.toThrow('not allowed');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects redirects leaving the Google allowlist', async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/tracker' },
      }),
    );

    await expect(
      service.mirror(
        'https://lh3.googleusercontent.com/a/avatar',
        'google-user-1',
      ),
    ).rejects.toThrow('not allowed');
  });

  it('rejects responses declaring an oversized image', async () => {
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': `${6 * 1024 * 1024}`,
        },
      }),
    );

    await expect(
      service.mirror(
        'https://lh3.googleusercontent.com/a/avatar',
        'google-user-1',
      ),
    ).rejects.toThrow('maximum size');
  });

  it('keeps the current file when absolute and relative URLs target it', async () => {
    const sourceImage = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#0b6f8a',
      },
    })
      .png()
      .toBuffer();
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array(sourceImage), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const mirrored = await service.mirror(
      'https://lh3.googleusercontent.com/a/avatar',
      'google-user-1',
    );

    await service.removePreviousManagedAvatar(
      `https://backend.onehealth.test${mirrored.photoURL}`,
      'google-user-1',
      mirrored.photoURL,
    );

    await expect(
      service.isManagedAvatarAvailable(mirrored.photoURL, 'google-user-1'),
    ).resolves.toBe(true);
  });
});
