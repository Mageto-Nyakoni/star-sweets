import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [
    tailwind({ applyBaseStyles: false }),
  ],
  output: 'server',
  // Vercel invokes SSR functions through an internal localhost URL, which
  // makes Astro's built-in origin comparison reject legitimate form posts.
  // The order endpoint performs its own exact production-origin validation.
  security: {
    checkOrigin: false,
  },
  adapter: vercel(),
});
