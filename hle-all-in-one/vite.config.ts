import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Bun deployment target (requires React 19). Build output lands in
// .output/server/index.mjs and is run with `bun .output/server/index.mjs`
// in the container — this is the smaller-image win driving the consolidation.
const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // `bun` is a runtime builtin (Bun.sql in src/server/db.ts). Keep it external
  // across every build environment so Rolldown doesn't try to resolve it; the
  // server-fn extraction keeps db.ts out of the client graph entirely.
  ssr: { external: ["bun"] },
  build: { rolldownOptions: { external: ["bun"] } },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "bun" }),
    viteReact(),
  ],
})

export default config
