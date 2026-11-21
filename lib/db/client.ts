import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { getEnv } from "@/lib/api/env";

let cached: NeonQueryFunction<false, false> | null = null;

/** Memoized Neon query function. */
export function getSql(): NeonQueryFunction<false, false> {
  if (!cached) cached = neon(getEnv().DATABASE_URL);
  return cached;
}
