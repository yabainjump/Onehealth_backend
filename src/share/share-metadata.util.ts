export interface SharePageMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  ogUrl: string;
  ogType: 'website' | 'article' | 'profile';
  imageUrl: string;
  imageType?: string;
  imageWidth?: number;
  imageHeight?: number;
  siteName: string;
  locale: string;
  twitterCard: 'summary' | 'summary_large_image';
  twitterSite?: string;
  appName?: string;
  authorName?: string;
  publishedTime?: string;
  redirectUrl?: string;
  shouldAutoRedirect?: boolean;
}

const BASIC_HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function normalizeText(value: string): string {
  const withDecodedEntities = decodeHtmlEntities(value || '');
  const withoutTags = withDecodedEntities.replace(/<[^>]+>/g, ' ');
  return withoutTags.replace(/\s+/g, ' ').trim();
}

export function truncateText(value: string, maxLength: number): string {
  const safeValue = (value || '').trim();
  if (!safeValue || maxLength <= 1 || safeValue.length <= maxLength) {
    return safeValue;
  }

  return `${safeValue.slice(0, maxLength - 1).trimEnd()}…`;
}

export function toAbsoluteUrl(
  rawUrl: string,
  baseUrl: string,
  fallbackUrl: string,
): string {
  const candidate = (rawUrl || '').trim();
  if (!candidate) {
    return fallbackUrl;
  }

  const hasWhitespace = /\s/.test(candidate);
  if (
    hasWhitespace &&
    !/^https?:\/\//i.test(candidate) &&
    !candidate.startsWith('/') &&
    !candidate.startsWith('./') &&
    !candidate.startsWith('../') &&
    !candidate.startsWith('//')
  ) {
    return fallbackUrl;
  }

  try {
    if (/^https?:\/\//i.test(candidate)) {
      return new URL(candidate).toString();
    }

    if (candidate.startsWith('//')) {
      const protocol = new URL(baseUrl).protocol || 'https:';
      return new URL(`${protocol}${candidate}`).toString();
    }

    return new URL(candidate, baseUrl).toString();
  } catch {
    return fallbackUrl;
  }
}

export function buildShareHtml(metadata: SharePageMetadata): string {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonicalUrl = escapeHtml(metadata.canonicalUrl);
  const ogUrl = escapeHtml(metadata.ogUrl);
  const ogType = escapeHtml(metadata.ogType);
  const imageUrl = escapeHtml(metadata.imageUrl);
  const imageType = metadata.imageType
    ? `<meta property="og:image:type" content="${escapeHtml(metadata.imageType)}" />`
    : '';
  const imageWidth = metadata.imageWidth
    ? `<meta property="og:image:width" content="${metadata.imageWidth}" />`
    : '';
  const imageHeight = metadata.imageHeight
    ? `<meta property="og:image:height" content="${metadata.imageHeight}" />`
    : '';
  const siteName = escapeHtml(metadata.siteName);
  const locale = escapeHtml(metadata.locale);
  const twitterCard = escapeHtml(metadata.twitterCard);
  const appName = escapeHtml(metadata.appName || metadata.siteName);
  const authorName = metadata.authorName
    ? `<meta property="article:author" content="${escapeHtml(metadata.authorName)}" />`
    : '';
  const publishedTime = metadata.publishedTime
    ? `<meta property="article:published_time" content="${escapeHtml(
        metadata.publishedTime,
      )}" />`
    : '';
  const twitterSite = metadata.twitterSite
    ? `<meta name="twitter:site" content="${escapeHtml(metadata.twitterSite)}" />`
    : '';
  const openLink = metadata.redirectUrl
    ? `<a class="share-link" href="${escapeHtml(metadata.redirectUrl)}">Open ${siteName}</a>`
    : '';
  const autoRedirectScript =
    metadata.redirectUrl && metadata.shouldAutoRedirect
      ? `
  <script>
    (() => {
      const targetUrl = ${escapeScriptLiteral(metadata.redirectUrl)};
      if (!targetUrl) return;
      setTimeout(() => {
        window.location.replace(targetUrl);
      }, 350);
    })();
  </script>`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta name="application-name" content="${appName}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  ${imageType}
  ${imageWidth}
  ${imageHeight}
  <meta property="og:image:alt" content="${title}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:locale" content="${locale}" />
  ${authorName}
  ${publishedTime}
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${title}" />
  ${twitterSite}
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(180deg, #edf3ff 0%, #ffffff 100%);
      color: #0a1f4d;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      width: min(560px, 100%);
      background: #ffffff;
      border: 1px solid #d9e5ff;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 14px 34px rgba(16, 51, 141, 0.12);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 1.25rem;
      line-height: 1.35;
    }
    p {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.6;
      color: #2d3f6b;
    }
    .share-link {
      display: inline-block;
      margin-top: 16px;
      color: #ffffff;
      text-decoration: none;
      background: #0b4ed6;
      border-radius: 10px;
      padding: 10px 16px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>${title}</h1>
    <p>${description}</p>
    ${openLink}
  </main>${autoRedirectScript}
</body>
</html>`;
}

export function isLikelyCrawler(userAgent: string): boolean {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) {
    return false;
  }

  return /(bot|crawler|spider|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|preview)/i.test(
    ua,
  );
}

function decodeHtmlEntities(value: string): string {
  let output = value;
  for (const [entity, decoded] of Object.entries(BASIC_HTML_ENTITIES)) {
    output = output.split(entity).join(decoded);
  }

  output = output.replace(/&#(\d+);/g, (_match, numericCode: string) => {
    const code = Number.parseInt(numericCode, 10);
    return Number.isFinite(code) ? String.fromCharCode(code) : '';
  });

  output = output.replace(/&#x([0-9a-fA-F]+);/g, (_match, hexCode: string) => {
    const code = Number.parseInt(hexCode, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : '';
  });

  return output;
}

/**
 * Serialise une valeur pour un litteral JavaScript inline. `JSON.stringify`
 * seul ne neutralise ni `</script>` ni les separateurs de ligne U+2028/U+2029 :
 * une valeur hostile pourrait fermer la balise et injecter du script. La valeur
 * est aujourd'hui construite par le serveur ; cette barriere evite qu'une
 * evolution future ne transforme la page de partage en XSS.
 */
function escapeScriptLiteral(value: string): string {
  return JSON.stringify(`${value || ''}`).replace(
    /[<>\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

function escapeHtml(value: string): string {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
