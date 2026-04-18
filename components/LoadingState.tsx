"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { label: "Identifying the activity", ms: 6000 },
  { label: "Researching location & details", ms: 9000 },
  { label: "Finding booking information", ms: 9000 },
  { label: "Saving to your Notion planner", ms: null },
];

export default function LoadingState() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const { ms } = STEPS[step];
    if (!ms) return;
    const t = setTimeout(() => setStep((s) => s + 1), ms);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#13131f] p-8">
      <div className="flex flex-col items-center py-8">
        {/* Spinner */}
        <div className="relative w-14 h-14 mb-7">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
          <div className="absolute inset-2 rounded-full bg-purple-500/10" />
        </div>

        <h2 className="text-base font-semibold text-zinc-100 mb-2">
          {STEPS[step].label}&hellip;
        </h2>
        <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">
          I'm researching this and saving it to Notion. This usually takes 20–50 seconds.
        </p>

        {/* Step dots */}
        <div className="flex gap-2 mt-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-700 ${
                i < step
                  ? "w-6 bg-purple-500"
                  : i === step
                  ? "w-8 bg-purple-400 opacity-80"
                  : "w-6 bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
