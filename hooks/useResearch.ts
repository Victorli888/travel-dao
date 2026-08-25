"use client";

import { useCallback, useState } from "react";
import { postResearch } from "@/lib/api/research-client";

/**
 * One value, four shapes. Replaces the parallel status/message/error flags
 * that let impossible states through (e.g. "success" with no message).
 */
export type ResearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; error: string };

export interface UseResearch {
  state: ResearchState;
  submit: (message: string) => Promise<void>;
  reset: () => void;
}

/** Owns the research request lifecycle. The only place the UI touches the API. */
export function useResearch(): UseResearch {
  const [state, setState] = useState<ResearchState>({ status: "idle" });

  const submit = useCallback(async (message: string) => {
    setState({ status: "loading" });
    try {
      setState({ status: "success", message: await postResearch(message) });
    } catch (err) {
      setState({
        status: "error",
        error:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, submit, reset };
}
