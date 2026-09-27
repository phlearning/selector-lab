// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://phlearning.github.io',
  base: '/selector-lab',
  trailingSlash: 'always',
  integrations: [preact()],
});
