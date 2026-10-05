# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                    # astro dev on :4321
npm run build                  # astro build -> ./dist
npm run preview                # serve the built output
npm run check                  # astro check (TypeScript + Astro diagnostics)

npm run refresh-contributions  # rebuild src/data/contributions.json from the APIs
npm run check:links            # scan dist/ for dead internal links (run after build)
npm run deploy                 # astro build && wrangler deploy
```

There is no test runner. `npm run check` plus `npm run build` plus `npm run check:links` is the
verification loop. `check:links` catches two bug classes that are invisible in source: section
anchors that only exist on the home page, and language-switcher links that assume both locales
share a slug. It scans **internal** routes only — a dead `githubUrl` or `demoUrl` in a project's
frontmatter passes silently, so re-check those by hand when editing project files.

## What this is

Bilingual (ID/EN) personal portfolio with a blog, project list and a baked GitHub + GitLab
contribution heatmap. Static Astro output, no adapter, deployed to Cloudflare as static assets
(`wrangler.jsonc` serves `./dist` through the `assets` binding, `not_found_handling: 404-page`).
It replaces an earlier Next.js 14 version of the same site.

Stack: Astro 7 (`output: static`, default), Tailwind 4 through the `@tailwindcss/vite` plugin,
MDX and sitemap integrations, fonts self-hosted via `@fontsource`, Zod 4 for collection schemas.
`@/*` maps to `src/*` (`tsconfig.json` extends `astro/tsconfigs/strict`).

## Architecture

### i18n and routing

Every locale is prefixed (`/id`, `/en`); `src/pages/index.astro` just redirects `/` to `/id`.
`src/pages/[locale]/` holds the home page, `blog/` and `projects/`. Each route declares
`getStaticPaths()` over `LOCALES` and then calls `resolveLocale(Astro.params.locale)`.

UI strings live in `src/i18n/id.json` and `src/i18n/en.json`, one namespace per section
(`Nav`, `Hero`, `About`, `Skills`, `Experience`, `Projects`, `Contributions`, `Blog`, `Meta`,
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

**A section that hides itself must also leave the nav.** `Contributions.astro` returns `null` while
`src/data/contributions.json` has no days, so `BaseLayout` computes `navSections` from
`hasContributions` (`src/lib/contributions.ts`) and passes it down as `sections`; `Header` forwards
it to both `NavLinks` instances. An unfiltered `#contributions` link would point at an anchor no page
renders — the exact bug `npm run check:links` reports. Do the same for any new conditional section.

`Header`/`NavLinks` take a `home` prop that `BaseLayout` derives from `path === ''`. On the home
page the section anchors exist, so nav links are `#about`; on every other page they become
`/id/#about`, because a bare `#about` there is dead. Nav, blog, and the language switcher sit in
the header; the social icons live in the footer, since three more icons overflow the `max-w-2xl`
row at `lg`. `NavLinks` and blog links appear at `lg` (64rem), so the header needs 64rem before it
shows everything — check any new nav item against that budget.

### Contribution heatmap

`src/data/contributions.json` is committed and is the only thing the build reads.
`scripts/fetch-contributions.mjs` regenerates it and runs daily from
`.github/workflows/refresh-contributions.yml` (which commits the result; the push triggers the
Cloudflare rebuild).

- GitHub needs `GH_CONTRIBUTIONS_TOKEN` (PAT with `read:user`) because `api.github.com/graphql`
  returns limit 0 unauthenticated and the REST API cannot report contribution counts. GitLab works
  unauthenticated via `/users?username=` then `/users/:id/events`; `GITLAB_TOKEN` only raises the
  rate limit.
- **On any failure the script leaves the existing JSON untouched and exits 0**, so a flaky API can
  never break a deploy.
- The script reads `GITHUB_USERNAME` / `GITLAB_USERNAME` out of `src/lib/social-links.ts` with a
  regex matching `export const NAME = '...'` — keep those declarations as single-line quoted string
  literals or the script silently reads an empty handle.
- `GITLAB_USERNAME` is still `''`; set it before the heatmap shows GitLab data. Until the JSON has
  days, the whole section and its nav entry stay hidden rather than showing an empty grid.
- `ContributionHeatmap` uses 12px cells with 3px gaps (826px) so a full 53-week year fits the
  content column (1104px) with room to spare.

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
- `PUBLIC_SITE_URL` feeds canonical links, hreflang, the sitemap and RSS. Keep
  `astro.config.mjs` and the fallback in `src/lib/site.ts` in sync when changing it.
- Secrets in play: `GH_CONTRIBUTIONS_TOKEN`, optional `GITLAB_TOKEN`, optional `CF_DEPLOY_HOOK`.
