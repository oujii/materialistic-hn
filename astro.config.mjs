import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [tailwind()],
  // Prefetch all visible links — critical on mobile where there's no hover.
  // Story rows in the listing are prefetched as soon as they enter the viewport,
  // so a tap navigates instantly with no Lambda round-trip in the foreground.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
