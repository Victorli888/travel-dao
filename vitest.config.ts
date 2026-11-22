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
      // next-auth imports `next/server` without the `.js` extension; Node's
      // ESM resolver won't find it unless we point at the file explicitly.
      "next/server": fileURLToPath(
        new URL("./node_modules/next/server.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    // Deliberately not UTC. `date` columns are bare `YYYY-MM-DD`, and a
    // formatter that forgets `timeZone: "UTC"` renders the day before for
    // anyone west of Greenwich. Under a UTC runner that bug passes its tests.
    env: { TZ: "America/Los_Angeles" },
  },
});
