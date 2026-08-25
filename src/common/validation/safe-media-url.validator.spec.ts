import { isSafeMediaUrl } from './safe-media-url.validator';

describe('isSafeMediaUrl', () => {
  const corsInitial = process.env.CORS_ORIGIN;

  beforeAll(() => {
    process.env.CORS_ORIGIN =
      'https://onehealthnetwork.yaba-in.com,https://backend.onehealthnetwork.yaba-in.com';
  });

  afterAll(() => {
    if (corsInitial === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = corsInitial;
    }
  });

  it.each([
    '/uploads/post/example.webp',
    'assets/default-profile.png',
    'https://backend.onehealthnetwork.yaba-in.com/uploads/post/file.pdf',
    'http://localhost:3000/uploads/message/file.txt',
    'https://lh3.googleusercontent.com/a/photo=s96-c',
    'https://firebasestorage.googleapis.com/v0/b/x/o/y.jpg',
  ])('accepte un média sûr : %s', (value) => {
    expect(isSafeMediaUrl(value)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/uploads/../secret.txt',
    '/uploads/post/file.webp\\evil',
    'https://user:password@example.com/file.pdf',
  ])('refuse un média dangereux : %s', (value) => {
    expect(isSafeMediaUrl(value)).toBe(false);
  });

  // Sans liste d'hôtes, un média pointant vers un serveur tiers transformait
  // chaque affichage en balise de pistage (IP, navigateur, horodatage).
  it.each([
    'https://attaquant.example/pixel.png',
    'https://evil.test/beacon.gif?u=1',
    'http://backend.onehealthnetwork.yaba-in.com/uploads/post/file.pdf',
    'https://googleusercontent.com.attaquant.example/a.png',
    'https://notfirebasestorage.googleapis.com.evil.test/x.jpg',
  ])('refuse un hôte non autorisé : %s', (value) => {
    expect(isSafeMediaUrl(value)).toBe(false);
  });
});
