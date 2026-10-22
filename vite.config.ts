import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import express from 'express';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Connect, type Plugin} from 'vite';

// Workers, shaders y assets de CesiumJS servidos desde /cesium/ (dev) y copiados a dist/cesium (build).
// Ver src/scene3d/cesiumEngine.ts (CESIUM_BASE_URL).
const CESIUM_BUILD = path.resolve(__dirname, 'node_modules/cesium/Build/Cesium');
const CESIUM_DIRS = ['Workers', 'ThirdParty', 'Assets', 'Widgets'];

function cesiumStatic(): Plugin {
  let outDir = 'dist';
  return {
    name: 'cesium-static',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/cesium', express.static(CESIUM_BUILD) as unknown as Connect.NextHandleFunction);
    },
    closeBundle() {
      for (const dir of CESIUM_DIRS) {
        fs.cpSync(path.join(CESIUM_BUILD, dir), path.join(outDir, 'cesium', dir), {recursive: true});
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), cesiumStatic()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
