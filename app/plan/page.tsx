import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

/**
 * A holding page so the landing's call to action does not lead nowhere. The
 * Day Planner screens land here in the next work unit.
 */
export default function PlanPage() {
  return (
    <main className="tao-ground flex min-h-screen items-center font-tao">
      <div className="mx-auto w-full max-w-[72rem] px-5 sm:px-8">
        <h1 className="m-0 max-w-[18ch] text-[clamp(1.75rem,4vw,2.5rem)] font-medium leading-tight tracking-[-0.025em] text-ink">
          The planner is still being built.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Adding places, the map and Plan It are the next thing. In the
          meantime you can research a place and file it in Notion.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/write-to-notion"
            className={buttonStyles({ variant: "tao", size: "md" })}
          >
            Write to Notion
          </Link>
          <Link
            href="/"
            className={buttonStyles({ variant: "taoQuiet", size: "bare" })}
          >
            Back to Travel Tao
          </Link>
        </div>
      </div>
    </main>
  );
}
