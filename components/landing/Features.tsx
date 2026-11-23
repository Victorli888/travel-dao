import Link from "next/link";
import { cn } from "@/lib/cn";
import { eyebrow, focusRing, sectionHeading } from "@/components/landing/styles";

const PLANNER_FEATURES = [
  "Create a trip with a name and two dates",
  "A column for every day, made the first time you open it",
  "The Activity Bank: everything saved for the trip, searchable",
  "Reopen any trip you have started",
];

function Check() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mt-[3px] h-4 w-4 shrink-0 text-tao"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

export default function Features() {
  return (
    <section aria-labelledby="features-heading" className="py-20 sm:py-24">
      <div className="max-w-[40rem]">
        <p className={eyebrow}>What is inside</p>
        <h2 id="features-heading" className={sectionHeading}>
          Plan your trip day by day.
        </h2>
      </div>

      <article
        className="mt-12 max-w-[40rem] rounded-3xl border border-rule/70 bg-paper p-7 sm:p-9"
      >
        <h3 className="m-0 text-[22px] font-semibold tracking-tight text-ink">
          Day Planner
        </h3>
        <p className="m-0 mt-1 text-[15px] text-ink-muted">Your trip, one day at a time.</p>

        <div className="rule-fade my-6" />

        <ul className="m-0 list-none space-y-3 p-0">
          {PLANNER_FEATURES.map((point) => (
            <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-ink">
              <Check />
              {point}
            </li>
          ))}
        </ul>

        <p className="m-0 mt-5 text-[13px] text-ink-subtle">
          Plan It, which arranges a day for you, is on the way.
        </p>

        <div className="pt-8">
          <Link
            href="/plan"
            className={cn(
              "rounded-md text-[15px] font-semibold text-tao transition-colors hover:text-tao-bright",
              focusRing,
            )}
          >
            Open the planner <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    </section>
  );
}
