// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://flyitalyadsb.com',
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});