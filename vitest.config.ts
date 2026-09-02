import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the "@/*" path mapping in tsconfig.json.
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` resolves to a module that throws on import, except under
      // the `react-server` condition Next.js supplies. Vitest is plain Node,
      // so point it at the empty build the package ships for exactly this.
      // A file path, not a deep import: the package's `exports` map declares
      // only ".", so "server-only/empty.js" is not resolvable by name.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
