import { NextResponse } from "next/server";
import { AppError } from "./errors";
import type { ResearchResponse } from "@/lib/types";

/** Success envelope. */
export function ok(message: string) {
  return NextResponse.json<ResearchResponse>({ success: true, message });
}

/**
 * The single place an error becomes a status code and a user-facing string.
 * Unknown errors are logged and reported generically.
 */
export function fail(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json<ResearchResponse>(
      { success: false, error: error.message },
      { status: error.status }
    );
  }

  console.error("Unhandled route error:", error);
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  return NextResponse.json<ResearchResponse>(
    { success: false, error: message },
    { status: 500 }
  );
}
