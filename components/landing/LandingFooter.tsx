import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

export default function LandingFooter() {
  return (
    <footer className="pb-16">
      <div className="rule-fade" />
      <div className="flex flex-wrap items-center justify-between gap-5 pt-8">
        <p className="m-0 max-w-[44ch] text-[15px] leading-relaxed text-ink-muted">
          Start with one day. A trip is only ever the days you actually planned.
        </p>
        <div className="flex flex-wrap items-center gap-3">
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
            Write to Notion
          </Link>
        </div>
      </div>
    </footer>
  );
}
