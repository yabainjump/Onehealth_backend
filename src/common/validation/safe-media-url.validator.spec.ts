import { isSafeMediaUrl } from './safe-media-url.validator';

describe('isSafeMediaUrl', () => {
  it.each([
    '/uploads/post/example.webp',
    'assets/default-profile.png',
    'https://backend.onehealthnetwork.yaba-in.com/uploads/post/file.pdf',
    'http://localhost:3000/uploads/message/file.txt',
  ])('accepts a safe media URL: %s', (value) => {
    expect(isSafeMediaUrl(value)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/uploads/../secret.txt',
    '/uploads/post/file.webp\\evil',
    'https://user:password@example.com/file.pdf',
  ])('rejects an unsafe media URL: %s', (value) => {
    expect(isSafeMediaUrl(value)).toBe(false);
  });
});
