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
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
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
