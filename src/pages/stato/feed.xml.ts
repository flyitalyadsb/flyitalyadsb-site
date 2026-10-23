// Atom feed of /stato/: incidents and planned maintenance (src/lib/status.ts).
import type { APIRoute } from 'astro';
import { statusFeed } from '../../lib/status';

export const GET: APIRoute = () => statusFeed('it');
