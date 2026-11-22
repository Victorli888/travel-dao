import Link from "next/link";
import { cn } from "@/lib/cn";
import { eyebrow, focusRing, sectionHeading } from "@/components/landing/styles";

const TOOLS = [
  {
    name: "Day Planner",
    tagline: "Your trip, one day at a time.",
    points: [
      "Create a trip with a name and two dates",
      "A column for every day, made the first time you open it",
      "The Activity Bank: everything saved for the trip, searchable",
      "Reopen any trip you have started",
    ],
    href: "/plan",
    cta: "Open the planner",
    soon: "Plan It, which arranges a day for you, is on the way.",
  },
  {
    name: "Write to Notion",
    tagline: "Save a place without the busywork.",
    points: [
      "Type a place and its full address",
      "A Claude agent confirms what is actually there",
      "It writes a short summary and picks a category",
      "The page lands in your Notion travel planner",
    ],
    href: "/write-to-notion",
    cta: "Save a place",
    soon: null,
  },
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
          Two tools, one trip.
        </h2>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {TOOLS.map((tool) => (
          <article
            key={tool.name}
            className="flex flex-col rounded-3xl border border-rule/70 bg-paper p-7 sm:p-9"
          >
            <h3 className="m-0 text-[22px] font-semibold tracking-tight text-ink">
              {tool.name}
            </h3>
            <p className="m-0 mt-1 text-[15px] text-ink-muted">{tool.tagline}</p>

            <div className="rule-fade my-6" />

            <ul className="m-0 list-none space-y-3 p-0">
              {tool.points.map((point) => (
                <li key={point} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                  <Check />
                  {point}
                </li>
              ))}
            </ul>

            {tool.soon && (
              <p className="m-0 mt-5 text-[13px] text-ink-subtle">{tool.soon}</p>
            )}

            <div className="mt-auto pt-8">
              <Link
                href={tool.href}
                className={cn(
                  "rounded-md text-[15px] font-semibold text-tao transition-colors hover:text-tao-bright",
                  focusRing,
                )}
              >
                {tool.cta} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
