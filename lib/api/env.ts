import { z } from "zod";
import { ConfigError } from "./errors";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/**
 * Parses and caches the server environment. Lazy on purpose — throwing at
 * module load would take down middleware and every route, not just the one
 * that needs the missing key.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new ConfigError(`Missing or invalid environment variables: ${missing}`);
  }

  cached = parsed.data;
  return cached;
}
