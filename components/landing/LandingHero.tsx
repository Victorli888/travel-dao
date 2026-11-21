import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

export default function LandingHero() {
  return (
    <header className="pb-10 pt-10 sm:pb-14 sm:pt-16">
      <h1 className="m-0 max-w-[17ch] text-[clamp(2.25rem,6vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.025em] text-ink">
        Pick your adventures. Let Tao show the way.
      </h1>
      <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-muted">
        Drop the places you want to see into a day. Plan It works out the
        order, the timings and the hops between them.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/plan"
          className={buttonStyles({ variant: "tao", size: "md" })}
        >
          Start planning
        </Link>
        <Link
          href="/write-to-notion"
          className={buttonStyles({ variant: "taoQuiet", size: "bare" })}
        >
          Or save a place to Notion
        </Link>
      </div>
    </header>
  );
}
