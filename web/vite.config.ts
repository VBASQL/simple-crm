import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server + build for the agent SPA. Output goes to web/dist, which
// firebase.json serves via Hosting.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
