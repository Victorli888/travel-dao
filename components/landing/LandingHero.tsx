import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import RouteIllustration from "@/components/landing/RouteIllustration";
import { focusRing } from "@/components/landing/styles";

export default function LandingHero() {
  return (
    <header className="grid items-center gap-12 pb-20 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14 lg:pt-20">
      <div>
        <p className="m-0 inline-flex items-center gap-2 rounded-full bg-sky/15 px-3 py-1 text-[13px] font-medium text-tao">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ember" />
          A day-by-day trip planner
        </p>
        <h1 className="m-0 mt-6 text-[clamp(2.5rem,4.4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          <span className="xl:block">Pick your adventures. </span>
          <span className="xl:block">Let Tao show the way.</span>
        </h1>
        <p className="m-0 mt-6 max-w-[48ch] text-[18px] leading-relaxed text-ink-muted">
          Name your trip and set the dates. Travel Tao lays out every day for
          you, and keeps the places you want to see together, ready to plan.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link
            href="/plan"
            className={buttonStyles({ variant: "ember", size: "md", className: "px-6" })}
          >
            Start planning
          </Link>
          <Link
            href="/write-to-notion"
            className={cn(
              "rounded-md text-[15px] font-medium text-tao underline decoration-sky decoration-2 underline-offset-[6px] transition-colors hover:decoration-tao",
              focusRing,
            )}
          >
            Or save a place to Notion
          </Link>
        </div>
        <p className="m-0 mt-8 text-[13px] text-ink-subtle">
          Private by invitation.
        </p>
      </div>

      <RouteIllustration />
    </header>
  );
}
