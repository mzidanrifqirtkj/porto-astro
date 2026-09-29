import {defineCollection} from 'astro:content';
import {glob} from 'astro/loaders';
import {z} from 'zod';

/**
 * Convention: files live in `<collection>/<locale>/<slug>.mdx`, so a glob id of
 * `id/halo-dunia` maps to locale `id` and slug `halo-dunia`.
 */
const blog = defineCollection({
  loader: glob({pattern: '**/*.mdx', base: './src/content/blog'}),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    locale: z.enum(['id', 'en']),
    /** Shared across translations of the same post. Slugs may differ per language, this pairs them. */
    translationKey: z.string().optional(),
    draft: z.boolean().default(false)
  })
});

const projects = defineCollection({
  loader: glob({pattern: '**/*.mdx', base: './src/content/projects'}),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    techStack: z.array(z.string()).default([]),
    demoUrl: z.url().nullable().default(null),
    githubUrl: z.url().nullable().default(null),
    image: z.string().nullable().default(null),
    locale: z.enum(['id', 'en']),
    order: z.number().default(0)
  })
});

export const collections = {blog, projects};
