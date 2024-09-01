// vite.config.js
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import terser from "@rollup/plugin-terser";

export default defineConfig({
  build: {
    lib: {
      entry: [resolve(__dirname, "src/index.ts")],
      name: "soteria",
      fileName: "index",
      formats: ["es", "cjs"],
    },
  },
  plugins: [
    dts(),
    terser({
      mangle: {
        properties: {
          regex: /^___/,
        },
      },
    }),
  ],
});
