import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/landing/styles";

export default function LandingNav() {
  return (
    <nav
      aria-label="Main"
      className="flex items-center justify-between gap-4 py-5 sm:py-6"
    >
      <Link
        href="/"
        className={cn("flex items-baseline gap-2 rounded-md no-underline", focusRing)}
      >
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          Travel Tao
        </span>
        <span aria-hidden="true" className="text-[15px] text-tao-soft">
          道
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-5">
        <Link
          href="/write-to-notion"
          className={cn(
            "hidden rounded-md text-[14px] font-medium text-ink-subtle transition-colors hover:text-tao sm:inline",
            focusRing,
          )}
        >
          Write to Notion
        </Link>
        <Link
          href="/plan"
          className={buttonStyles({
            variant: "tao",
            size: "sm",
            className: focusRing,
          })}
        >
          Open planner
        </Link>
      </div>
    </nav>
  );
}
