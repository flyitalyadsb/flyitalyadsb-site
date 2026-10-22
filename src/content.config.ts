import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// API documentation pages: one Markdown file per page and language under
// src/content/docs/{it,en}/. `key` pairs the two languages of a page (and
// orders the sidebar with `order`); the URL slug is the file name, which
// src/lib/routes.ts maps between Italian and English.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    key: z.string(),
    order: z.number(),
    updated: z.coerce.date(),
    // The plan table from src/data/plans.ts above the text, so the numbers
    // live in one place.
    plans: z.boolean().default(false),
  }),
});

export const collections = { docs };
