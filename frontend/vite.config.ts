import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import type { Plugin } from "vite";

/** Public pages are prerendered (scripts/prerender.mjs), so app JS no longer gates first paint:
 *  load it at low priority and let the browser prioritise HTML, CSS and fonts. */
function lowPriorityAppScripts(): Plugin {
  return {
    name: "saleem-low-priority-scripts",
    enforce: "post",
    transformIndexHtml(html) {
      return html
        .replace(/<link rel="modulepreload"[^>]*>\s*/g, "")
        .replace(
          /<script type="module" crossorigin/g,
          '<script type="module" fetchpriority="low" crossorigin',
        );
    },
  };
}

/** Mirrors production hosting in `vite preview`: real files and prerendered pages are served
 *  as-is; every other path falls back to the clean SPA shell (dist/spa.html). */
function spaFallback(): Plugin {
  return {
    name: "saleem-spa-fallback",
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = (req.url ?? "/").split("?")[0]!;
        const dist = path.resolve(__dirname, "dist");
        const isFile = /\.[a-z0-9]+$/i.test(url);
        const prerendered = url === "/" || fs.existsSync(path.join(dist, url, "index.html"));
        if (!isFile && !prerendered && fs.existsSync(path.join(dist, "spa.html")))
          req.url = "/spa.html";
        next();
      });
    },
  };
}

export default defineConfig({
  envDir: "../backend",
  plugins: [
    // TanStack Router plugin must come before any JSX transform
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      autoCodeSplitting: true,
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    lowPriorityAppScripts(),
    spaFallback(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Fewer, intentional chunks: a long chain of tiny chunks is slow on mobile networks.
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: "vendor-tslib", test: /node_modules[\\/]tslib[\\/]/, priority: 40 },
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            { name: "vendor-router", test: /node_modules[\\/]@tanstack[\\/]/, priority: 25 },
            { name: "vendor-supabase", test: /node_modules[\\/]@supabase[\\/]/, priority: 25 },
          ],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
