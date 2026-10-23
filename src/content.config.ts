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

// Status page incidents and planned maintenance (/stato/, /en/status/ and
// their Atom feeds): one Markdown file per event and language under
// src/content/status/{it,en}/, paired by `key`. The body is the summary;
// `updates` the timeline, newest last. No `end` = still ongoing (incident) or
// not finished yet (maintenance). Components use the status Worker's ids
// (status-worker/src/checks.ts).
const STATUS_COMPONENTS = ['site', 'map', 'live', 'api', 'history', 'mcp', 'feeders', 'mlat'] as const;
const status = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/status' }),
  schema: z.object({
    title: z.string(),
    key: z.string(),
    kind: z.enum(['incident', 'maintenance']),
    // minor: some people or one function affected; major: a service down.
    impact: z.enum(['minor', 'major']),
    components: z.array(z.enum(STATUS_COMPONENTS)).min(1),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    updates: z.array(z.object({
      at: z.coerce.date(),
      state: z.enum(['investigating', 'identified', 'monitoring', 'resolved', 'scheduled', 'in_progress', 'completed']),
      text: z.string(),
    })).default([]),
  }),
});

export const collections = { docs, status };
