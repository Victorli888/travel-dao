"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";

export interface ProgressStep {
  label: string;
  /** How long to dwell before advancing. `null` means "stay until done". */
  ms: number | null;
}

/**
 * Mirrors the phases in the system prompt: research, then submit to the
 * activity bank.
 */
export const RESEARCH_STEPS: ProgressStep[] = [
  { label: "Identifying the place", ms: 6000 },
  { label: "Researching details & hours", ms: 9000 },
  { label: "Preparing the activity", ms: 5000 },
  { label: "Saving to your activity bank", ms: null },
];

interface Props {
  steps?: ProgressStep[];
}

/**
 * Optimistic progress indicator. The timer is presentation only — it reflects
 * expected pacing, not real backend events.
 */
export default function ResearchProgress({ steps = RESEARCH_STEPS }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const { ms } = steps[step];
    if (ms === null || step >= steps.length - 1) return;
    const timer = setTimeout(() => setStep((s) => s + 1), ms);
    return () => clearTimeout(timer);
  }, [step, steps]);

  return (
    <Card className="p-8">
      <div className="flex flex-col items-center py-8">
        <Spinner />

        <h2 className="text-base font-semibold text-zinc-100 mb-2">
          {steps[step].label}&hellip;
        </h2>
        <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">
          I&apos;m researching this and saving it to your activity bank. This
          usually takes 15–40 seconds.
        </p>

        <div className="flex gap-2 mt-8">
          {steps.map((s, i) => (
            <div
              key={s.label}
              className={`h-1 rounded-full transition-all duration-700 ${
                i < step
                  ? "w-6 bg-accent-bright"
                  : i === step
                    ? "w-8 bg-accent-light opacity-80"
                    : "w-6 bg-line"
              }`}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function Spinner() {
  return (
    <div className="relative w-14 h-14 mb-7">
      <div className="absolute inset-0 rounded-full border-2 border-accent-bright/20" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-bright animate-spin" />
      <div className="absolute inset-2 rounded-full bg-accent-bright/10" />
    </div>
  );
}
