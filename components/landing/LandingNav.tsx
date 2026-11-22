import Link from "next/link";

export default function LandingNav() {
  return (
    <nav className="flex items-baseline justify-between gap-6 py-6">
      <Link href="/" className="flex items-baseline gap-2 no-underline">
        <span className="text-[17px] font-medium tracking-tight text-ink">
          Travel Tao
        </span>
        <span className="text-[15px] text-tao-soft">道</span>
      </Link>
      <Link
        href="/plan"
        className="text-[13px] font-medium text-ink-subtle underline-offset-4 transition-colors hover:text-ember"
      >
        Your trips
      </Link>
    </nav>
  );
}
