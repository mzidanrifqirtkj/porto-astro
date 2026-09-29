import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Keep in sync with the fallback in src/lib/site.ts.
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://porto-astro.pages.dev';

export default defineConfig({
  site: SITE_URL,
  integrations: [
    mdx(),
    // Emits <xhtml:link rel="alternate"> entries so the ID and EN pages point at each other.
    sitemap({
      i18n: {
        defaultLocale: 'id',
        locales: {id: 'id-ID', en: 'en-US'}
      }
    })
  ],
  i18n: {
    locales: ['id', 'en'],
    defaultLocale: 'id',
    routing: {
      // Every locale is prefixed (/id, /en), matching the previous Next.js setup.
      prefixDefaultLocale: true,
      // src/pages/index.astro already redirects `/` to `/id`. Leaving Astro's own
      // redirect on makes both routes claim `/` and the build warns about the clash.
      redirectToDefaultLocale: false
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
