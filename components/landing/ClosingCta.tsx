import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

/**
 * The page's one dark block: navy, so the closing call to action reads as an
 * ending. The button repeats the hero's action, so it repeats its colour.
 */
export default function ClosingCta() {
  return (
    <section
      aria-labelledby="closing-heading"
      className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center sm:px-12 sm:py-20"
    >
      {/* A faint dotted route crossing the block, echoing the hero. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 800 300"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        fill="none"
      >
        <path
          d="M-20 250 C 160 180, 260 290, 420 190 S 680 60, 820 90"
          className="stroke-sky"
          strokeOpacity="0.35"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.5 12"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="relative">
        <h2
          id="closing-heading"
          className="m-0 mx-auto max-w-[20ch] text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-paper"
        >
          Your next trip starts with a name and two dates.
        </h2>
        <p className="m-0 mx-auto mt-4 max-w-[42ch] text-[17px] leading-relaxed text-sky">
          Set them now. The days will be waiting when you come back.
        </p>
        <div className="mt-9 flex justify-center">
          <Link
            href="/plan"
            className={buttonStyles({
              variant: "ember",
              size: "md",
              className: "px-7 focus-visible:outline-paper",
            })}
          >
            Start planning
          </Link>
        </div>
      </div>
    </section>
  );
}
