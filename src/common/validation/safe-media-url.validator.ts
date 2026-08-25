import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const LOCAL_MEDIA_PATH = /^(?:\/uploads|assets)\/[A-Za-z0-9._/-]+$/;

export function isSafeMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  const containsControlCharacter = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

  if (/\s|\\/.test(value) || containsControlCharacter) {
    return false;
  }

  if (value.startsWith('/uploads/') || value.startsWith('assets/')) {
    return LOCAL_MEDIA_PATH.test(value) && !value.split('/').includes('..');
  }

  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      return false;
    }
    if (parsed.protocol !== 'https:' && !isLocalHttpOrigin(parsed)) {
      return false;
    }
    return isAllowedMediaHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Hotes distants acceptes pour un media fourni par un utilisateur.
 *
 * Sans cette liste, n'importe quelle URL https etait acceptee : une photo de
 * profil ou une piece jointe pouvait pointer vers un serveur tiers, qui
 * recoltait alors l'adresse IP, le navigateur et l'horodatage de chaque
 * personne affichant le contenu — y compris dans une conversation privee, ou
 * cela revient a un accuse de lecture clandestin.
 */
const STATIC_MEDIA_HOSTS = [
  'googleusercontent.com',
  'firebasestorage.googleapis.com',
];

function isLocalHttpOrigin(parsed: URL): boolean {
  return (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  );
}

function ownMediaHosts(): string[] {
  const origins = [
    `${process.env.PUBLIC_BASE_URL || ''}`,
    ...`${process.env.CORS_ORIGIN || ''}`.split(','),
  ];

  const hosts: string[] = [];
  for (const origin of origins) {
    const value = origin.trim();
    if (!value) {
      continue;
    }
    try {
      hosts.push(new URL(value).hostname.toLowerCase());
    } catch {
      // Une origine mal formee est ignoree : elle ne doit rien autoriser.
    }
  }
  return hosts;
}

function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) {
    return false;
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return true;
  }
  if (ownMediaHosts().includes(host)) {
    return true;
  }
  return STATIC_MEDIA_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export function IsSafeMediaUrl(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isSafeMediaUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isSafeMediaUrl(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be an HTTP(S) URL or a local media path`;
        },
      },
    });
  };
}
