import { defineConfig } from 'vite';

// `base` is set for GitHub Pages project-site hosting (/stitch-forge/).
// Override with BASE=/ for local/relative builds.
export default defineConfig({
  base: process.env.BASE ?? '/stitch-forge/',
  build: {
    target: 'es2021',
    outDir: 'dist',
    sourcemap: false,
  },
});
