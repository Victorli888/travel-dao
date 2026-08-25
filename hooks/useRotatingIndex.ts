"use client";

import { useEffect, useState } from "react";

interface Options {
  /** How long each item stays on screen. */
  intervalMs?: number;
  /** Fade-out window before the index advances. */
  fadeMs?: number;
}

/**
 * Cycles 0..length-1 on a timer, reporting a `visible` flag so the consumer
 * can fade out before the swap.
 */
export function useRotatingIndex(
  length: number,
  { intervalMs = 4000, fadeMs = 300 }: Options = {}
) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (length <= 1) return;

    let fade: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setVisible(false);
      fade = setTimeout(() => {
        setIndex((i) => (i + 1) % length);
        setVisible(true);
      }, fadeMs);
    }, intervalMs);

    return () => {
      clearInterval(interval);
      clearTimeout(fade);
    };
  }, [length, intervalMs, fadeMs]);

  return { index, visible };
}
