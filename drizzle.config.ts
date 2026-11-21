import { config } from "dotenv";

// drizzle-kit runs outside Next.js, which is the only thing that loads
// .env.local automatically. Without this the CLI sees no DATABASE_URL.
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
