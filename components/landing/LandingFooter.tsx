import Link from "next/link";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/landing/styles";

const LINKS = [
  { href: "/plan", label: "Day Planner" },
  { href: "/write-to-notion", label: "Write to Notion" },
];

export default function LandingFooter() {
  return (
    <footer className="pb-12 pt-16">
      <div className="rule-fade" />
      <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Travel Tao
          </span>
          <span aria-hidden="true" className="text-[14px] text-tao-soft">
            道
          </span>
          <span className="text-[14px] text-ink-subtle">The way through your trip.</span>
        </p>
        <nav aria-label="Footer">
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "rounded-md text-[14px] font-medium text-ink-subtle transition-colors hover:text-tao",
                    focusRing,
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
