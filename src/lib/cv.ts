import type {Locale} from '@/i18n/ui';

export function resolveCvHref(locale: Locale): string {
  return `/cv/cv-${locale}.pdf`;
}

export function resolveCvFilename(locale: Locale): string {
  return `cv-${locale}.pdf`;
}
