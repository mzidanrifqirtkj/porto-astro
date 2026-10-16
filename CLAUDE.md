# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                    # astro dev on :4321
npm run build                  # astro build -> ./dist
npm run preview                # serve the built output
npm run check                  # astro check (TypeScript + Astro diagnostics)

npm run check:links            # scan dist/ for dead internal links (run after build)
npm run deploy                 # astro build && wrangler deploy
```

There is no test runner. `npm run check` plus `npm run build` plus `npm run check:links` is the
verification loop. `check:links` catches two bug classes that are invisible in source: section
anchors that only exist on the home page, and language-switcher links that assume both locales
share a slug. It scans **internal** routes only — a dead `githubUrl` or `demoUrl` in a project's
frontmatter passes silently, so re-check those by hand when editing project files.

## What this is

Bilingual (ID/EN) personal portfolio with a blog and a project list. Static Astro output, no
adapter, deployed to Cloudflare as static assets
(`wrangler.jsonc` serves `./dist` through the `assets` binding, `not_found_handling: 404-page`).
It replaces an earlier Next.js 14 version of the same site.

Stack: Astro 7 (`output: static`, default), Tailwind 4 through the `@tailwindcss/vite` plugin,
MDX and sitemap integrations, fonts self-hosted via `@fontsource`, Zod 4 for collection schemas.
`@/*` maps to `src/*` (`tsconfig.json` extends `astro/tsconfigs/strict`).

## Architecture

### i18n and routing

Every locale is prefixed (`/id`, `/en`); `src/pages/index.astro` redirects `/` to `/en` with a 301,
which makes Astro's static redirect template emit a 0-second refresh rather than the 2-second one it
uses for a 302. English is the default: `DEFAULT_LOCALE` in `src/i18n/ui.ts`, `i18n.defaultLocale`
and the sitemap's `defaultLocale` in `astro.config.mjs`, `x-default` in `BaseLayout`, and the RSS
feed all point at `en`. Change them together — a half-moved default makes the sitemap disagree with
the redirect. The sitemap `filter` excludes `/`, which is a `noindex` redirect that parses to the
same i18n path as `/en/` and would otherwise duplicate its alternate.
`src/pages/[locale]/` holds the home page, `blog/` and `projects/`. Each route declares
`getStaticPaths()` over `LOCALES` and then calls `resolveLocale(Astro.params.locale)`.

UI strings live in `src/i18n/id.json` and `src/i18n/en.json`, one namespace per section
(`Nav`, `Hero`, `About`, `Skills`, `Experience`, `Projects`, `Blog`, `Meta`,
`Footer`, …). Components read them through `src/i18n/ui.ts`:

```ts
t(locale, 'Hero', 'greeting', {name})        // interpolates {name}
tRaw<SkillCategory[]>(locale, 'Skills', 'categories')  // arrays and objects
```

Both locale files must stay in sync — same namespaces, same keys. A missing key throws at build
time rather than rendering an empty string, so a forgotten translation fails the build, not the page.

Adding a language touches four places: `LOCALES` in `src/i18n/ui.ts`, `locales` in
`astro.config.mjs`, a new `src/i18n/<locale>.json`, and the `locale` enum in
`src/content.config.ts`.

### Content collections

Defined in `src/content.config.ts`. Files live at `<collection>/<locale>/<slug>.mdx`, so a glob id
of `id/swakarta` parses into locale `id` and slug `swakarta` — that split is done in each route
(`id.split('/')`), not by the loader. Frontmatter is Zod-validated at build time.

Blog slugs are language-specific (`dari-nextjs-ke-astro` vs `moving-from-nextjs-to-astro`), so
translations are paired by the optional `translationKey` frontmatter field, not by filename. The
post route looks up the sibling with the same key in the other locale and passes its slug to
`BaseLayout` as `translationSlug`, which the language switcher uses. **A post translated without a
matching `translationKey` gets a 404-ing switcher link** — `npm run check:links` catches it.

Skills and experience stay as array data inside the i18n JSON (short lists, no body); the blog and
projects are collections.

### Components and layout

`src/layouts/BaseLayout.astro` owns `<html>`, fonts, metadata, header/footer, and the scroll-reveal
`IntersectionObserver`. It takes `locale`, optional `title`/`description`, and `path` (relative to
the locale root, e.g. `/blog`) which it uses to build the canonical URL and the `hreflang`
alternates. Pass `path` on every route other than the home page — a non-empty `path` also switches
the default meta description from the short `About.description` (home) to `Meta.description`, and
`routing.redirectToDefaultLocale` stays `false` because `src/pages/index.astro` owns the `/` redirect
(`true` makes both claim `/` and the build warns).

Section components take a `locale` prop and read their own strings. Reusable primitives are
`AnimatedSection`, `Chip`, `SectionEyebrow` plus `icons/`.

Adding a nav section means three coordinated edits: an entry in `NAV_SECTIONS`
(`src/components/NavLinks.astro`), a matching `Nav` key in both locale JSON files, and an `id` on
the section's `AnimatedSection`.

**A section that hides itself must also leave the nav.** No section does this today, but if you add
one that renders `null` conditionally, it must not keep its `NAV_SECTIONS` entry — an unfiltered
link would point at an anchor no page renders, which is the exact bug `npm run check:links`
reports. Filter the list in `BaseLayout` and pass it down as `sections`; `Header` forwards it to
both `NavLinks` instances.

`Header`/`NavLinks` take a `home` prop that `BaseLayout` derives from `path === ''`. On the home
page the section anchors exist, so nav links are `#about`; on every other page they become
`/id/#about`, because a bare `#about` there is dead. Nav, blog, and the language switcher sit in
the header; the social icons live in the footer, since three more icons overflow the `max-w-2xl`
row at `lg`. `NavLinks` and blog links appear at `lg` (64rem), so the header needs 64rem before it
shows everything — check any new nav item against that budget.

### Projects

Projects are a content collection. Each carries a required `date` (month precision is enough); both
the home section (`src/components/Projects.astro`) and the full list
(`src/pages/[locale]/projects/index.astro`) group them under year headings, newest first, with the
year derived from the date. The sort and grouping live in `src/lib/projects.ts` — one place, so the
two call sites cannot drift. A missing `date` fails the build rather than sorting silently. The slug
breaks date ties, so both locales list projects in the same order even though titles differ.

Each project also has a detail page at `src/pages/[locale]/projects/[slug].astro`, reached from the
row title (not the whole row — the row also contains demo and GitHub anchors, and nesting anchors is
invalid HTML). That route renders the `.mdx` body, so the body is no longer dead weight.

There is no screenshot field. `src/components/ProjectRow.astro` is a text row — title, description,
tech stack — used by both call sites.

### Article typography

`.prose-custom` lives in `src/styles/global.css` and is shared by the blog post route and the
project detail route. Do not reintroduce a per-file copy.

## Conventions

- Design tokens are declared once in `src/styles/global.css` under `@theme` (Tailwind 4): `canvas`,
  `surface`, `border`, `ink`, `ink-muted`, `signal`, the three font families, and the `hero-glow` /
  `avatar-ring` / `pulse-dot` utilities. Use the token names, not raw hex values.
- Section layout: `AnimatedSection` wrapper (`scroll-mt-24 px-6 py-16`) plus an inner
  `mx-auto max-w-6xl` container. **Two width layers, don't collapse them.** The shell (header,
  footer, sections, grids) is 72rem/1152px so the page fills a wide viewport; paragraph text stays
  narrower — `max-w-2xl` for `text-base` copy, `max-w-xl` for the 14px blog list — because a 1152px
  line runs ~150 characters and reads slowly. Cards are flexible (`aspect-video` thumbnails derive
  their height), so a grid column-count change needs no card edit.
- Animation must respect `prefers-reduced-motion`; reveals are CSS transitions toggled by
  `IntersectionObserver`, and the page stays fully visible without JavaScript.
- Client JavaScript is inline `<script>` inside `.astro` files, only where interaction genuinely
  needs it (nav highlighting, mobile menu, scroll-to-top).
- `PUBLIC_SITE_URL` feeds canonical links, hreflang, the sitemap, RSS, `robots.txt` and the
  `og:image` URL. Keep `astro.config.mjs` and the fallback in `src/lib/site.ts` in sync when
  changing it. Both fall back to the production domain, so a build with no env var still emits the
  right canonical — never let that fallback point at a host we do not own.
- `og:image` defaults to the site-wide `public/images/og.png`. `BaseLayout` accepts an `ogImage`
  prop (absolute URL or site-relative path) to override it per page; the blog schema exposes
  `ogImage` for posts. The `og:image:type` / `width` / `height` tags are only emitted for the
  default card, since dimensions are unknown for a custom image.
