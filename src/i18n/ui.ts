import id from './id.json';
import en from './en.json';

export const LOCALES = ['id', 'en'] as const;
export const DEFAULT_LOCALE = 'id';

export type Locale = (typeof LOCALES)[number];

const MESSAGES: Record<Locale, unknown> = {id, en};

export function resolveLocale(value: string | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? '') ? (value as Locale) : DEFAULT_LOCALE;
}

type Vars = Record<string, string | number>;

/**
 * Resolves `Namespace.key` for a locale and interpolates `{placeholders}`.
 * Replaces next-intl's `useTranslations`; arrays and objects under a key need
 * `t.raw` instead.
 */
export function t(locale: Locale, namespace: string, key: string, vars?: Vars): string {
  const bucket = (MESSAGES[locale] as Record<string, Record<string, unknown>>)[namespace];
  const value = bucket?.[key];

  if (typeof value !== 'string') {
    throw new Error(`Missing message: ${locale} ${namespace}.${key}`);
  }

  if (!vars) return value;

  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/** Reads a structured value (array or object) out of a namespace. */
export function tRaw<T>(locale: Locale, namespace: string, key: string): T {
  const bucket = (MESSAGES[locale] as Record<string, Record<string, unknown>>)[namespace];
  const value = bucket?.[key];

  if (value === undefined) {
    throw new Error(`Missing message: ${locale} ${namespace}.${key}`);
  }

  return value as T;
}
