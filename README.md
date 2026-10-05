# porto-astro

Bilingual (ID/EN) personal portfolio with a blog, project list and a baked GitHub + GitLab
contribution heatmap. Built with Astro and Tailwind, deployed to Cloudflare as static assets.

Replaces an earlier Next.js 14 version of the same site.

## Commands

```bash
npm install
npm run dev                    # astro dev on :4321
npm run build                  # astro build -> ./dist
npm run preview                # serve the built output
npm run check                  # astro check (TypeScript + Astro diagnostics)

npm run refresh-contributions  # rebuild src/data/contributions.json from the APIs
npm run check:links            # scan dist/ for dead internal links (after build)
npm run deploy                 # astro build && wrangler deploy
```

There is no test runner configured. `npm run check`, `npm run build` and `npm run check:links` is
the verification loop.

## How content works

**UI strings** live in `src/i18n/id.json` and `src/i18n/en.json`, one namespace per section
(`Nav`, `Hero`, `About`, `Skills`, `Experience`, `Projects`, `Contributions`, `Blog`, `Meta`,
`Footer`, …). Components read them through `src/i18n/ui.ts`:

```ts
t(locale, 'Hero', 'greeting', {name})   // interpolates {name}
tRaw<SkillCategory[]>(locale, 'Skills', 'categories')  // arrays/objects
```

Both locale files must stay in sync — same namespaces, same keys. A missing key throws at build
time rather than rendering an empty string.

**Blog posts and projects** are content collections, defined in `src/content.config.ts`. Files live
at `<collection>/<locale>/<slug>.mdx`:

```
src/content/blog/id/dari-nextjs-ke-astro.mdx
src/content/blog/en/moving-from-nextjs-to-astro.mdx
src/content/projects/id/swakarta.mdx
```

The glob id (`id/swakarta`) is parsed into locale and slug, so adding a post means adding one file —
frontmatter is validated against the schema at build time. Skills and experience are still array
data inside the i18n JSON, since they are shorter lists without a body.

## Adding a language

Four places: `LOCALES` in `src/i18n/ui.ts`, `locales` in `astro.config.mjs`, a new
`src/i18n/<locale>.json`, and the `locale` enum in `src/content.config.ts`.

## Contribution heatmap

`src/data/contributions.json` is the only source the build reads. `scripts/fetch-contributions.mjs`
regenerates it and is run on a schedule by `.github/workflows/refresh-contributions.yml`.

- **GitHub** needs a token. `api.github.com/graphql` returns limit 0 unauthenticated, and the REST API
  cannot report contribution counts, so `GH_CONTRIBUTIONS_TOKEN` (PAT with `read:user`) is required.
- **GitLab** works unauthenticated, via `/users?username=` then `/users/:id/events` paginated.
  `GITLAB_TOKEN` is optional and only raises the rate limit.
- On any failure the script leaves the existing JSON untouched and exits 0, so a flaky API can never
  break a deploy. The site just keeps the last good data.

Secrets: `GH_CONTRIBUTIONS_TOKEN`, optional `GITLAB_TOKEN`, optional `CF_DEPLOY_HOOK`. Set the GitLab
handle in `src/lib/social-links.ts` (`GITLAB_USERNAME`) before the first run.

Until the JSON has days, the section and its nav entry are hidden entirely — an empty grid reads as
"0 contributions". `ContributionHeatmap` uses 9px cells so a full year fits without horizontal scroll.

## Deploying to Cloudflare

Static output, so no adapter — `wrangler.jsonc` serves `./dist` through the `assets` binding.

- **Git-connected build**: build command `npm run build`, output directory `dist`.
- **CLI**: `npm run deploy`.

`assets.not_found_handling` is `404-page`, so `src/pages/404.astro` is served for unmatched routes.
Set `PUBLIC_SITE_URL` to the production URL; it feeds canonical links, hreflang, the sitemap and RSS
(see `.env.example`).

## Structure

```
src/
  content.config.ts     collection schemas (blog, projects)
  data/                 contributions.json (committed build input)
  i18n/                 ui.ts + id.json / en.json
  layouts/BaseLayout.astro   <html>, metadata, header/footer, reveal observer
  components/           one per section, plus Chip/SectionEyebrow/AnimatedSection primitives
  pages/[locale]/       index, blog/, projects/
scripts/fetch-contributions.mjs
```

## Conventions

- Design tokens are declared once in `src/styles/global.css` under `@theme` (Tailwind 4): `canvas`,
  `surface`, `border`, `ink`, `ink-muted`, `signal`, the three font families, and the `hero-glow` /
  `avatar-ring` / `pulse-dot` utilities. Use the token names, not raw hex values.
- Section layout: `AnimatedSection` wrapper (`scroll-mt-24 px-6 py-16`) plus an inner
  `mx-auto max-w-6xl` container. The shell is 72rem wide to fill a large viewport; paragraph text
  is deliberately narrower (`max-w-2xl` / `max-w-xl`) so lines stay a readable length.
- Nav anchors come from `NAV_SECTIONS` in `src/components/NavLinks.astro`. Adding a section means an
  entry there, a `Nav` key, and a matching `id` on its `AnimatedSection`.
- Animation must respect `prefers-reduced-motion`. Reveals are CSS transitions toggled by
  `IntersectionObserver`; the page stays fully visible without JavaScript.
- Client JavaScript is written as inline `<script>` in `.astro` files only where interaction
  genuinely needs it (nav highlighting, mobile menu, scroll-to-top).
