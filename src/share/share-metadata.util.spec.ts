import {
  buildShareHtml,
  normalizeText,
  toAbsoluteUrl,
  truncateText,
} from './share-metadata.util';

describe('share-metadata.util', () => {
  it('normalizes text by removing html tags and collapsing spaces', () => {
    const input = '  Hello <strong>World</strong> &amp; everyone   ';
    expect(normalizeText(input)).toBe('Hello World & everyone');
  });

  it('truncates long text with an ellipsis', () => {
    expect(truncateText('abcdef', 5)).toBe('abcd…');
    expect(truncateText('short', 10)).toBe('short');
  });

  it('returns absolute urls with fallback support', () => {
    expect(
      toAbsoluteUrl('/uploads/post/img.png', 'https://onehealth.app', 'https://fallback/app.png'),
    ).toBe('https://onehealth.app/uploads/post/img.png');

    expect(
      toAbsoluteUrl('not a url', 'https://onehealth.app', 'https://fallback/app.png'),
    ).toBe('https://fallback/app.png');
  });

  it('renders essential open graph and twitter metadata', () => {
    const html = buildShareHtml({
      title: 'Sample Post',
      description: 'Sample Description',
      canonicalUrl: 'https://onehealth.app/posts/abc',
      ogUrl: 'https://onehealth.app/posts/abc?v=5',
      ogType: 'article',
      imageUrl: 'https://onehealth.app/assets/cover.png',
      siteName: 'One Health Network',
      locale: 'fr_FR',
      twitterCard: 'summary_large_image',
      appName: 'One Health Network',
      redirectUrl: 'https://onehealth.app/posts/abc',
      shouldAutoRedirect: false,
    });

    expect(html).toContain('property="og:title" content="Sample Post"');
    expect(html).toContain('property="og:description" content="Sample Description"');
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('property="og:url" content="https://onehealth.app/posts/abc?v=5"');
    expect(html).toContain('property="og:image" content="https://onehealth.app/assets/cover.png"');
    expect(html).toContain('name="twitter:title" content="Sample Post"');
    expect(html).toContain('name="twitter:description" content="Sample Description"');
    expect(html).toContain('name="twitter:image" content="https://onehealth.app/assets/cover.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('rel="canonical" href="https://onehealth.app/posts/abc"');
  });
});
