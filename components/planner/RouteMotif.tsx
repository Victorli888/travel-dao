import { cn } from "@/lib/cn";

/**
 * The landing's travel motif in miniature: a dotted route between pins ending
 * in the ember plane. Decoration only — `aria-hidden`, no data in it — so it
 * can fill bare space without saying anything untrue about the trip.
 *
 * `tone="dark"` draws in sky for the navy band; `"light"` in ocean for white.
 * The dash animation is `motion-safe:` only, like the landing's.
 */
export default function RouteMotif({
  tone = "light",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const line = tone === "dark" ? "stroke-sky" : "stroke-tao/40";
  const pin = tone === "dark" ? "fill-sky" : "fill-tao/70";
  const hole = tone === "dark" ? "fill-ink" : "fill-paper";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 140"
      fill="none"
      className={cn("pointer-events-none", className)}
    >
      <g className={tone === "dark" ? "stroke-sky/20" : "stroke-sky/50"} strokeWidth="1">
        <path d="M-10 40 C 60 10, 120 70, 200 36 S 300 10, 330 30" />
        <path d="M-10 118 C 70 92, 150 140, 230 108 S 310 90, 330 100" />
      </g>
      <path
        d="M20 112 C 50 70, 80 60, 112 78 S 170 104, 206 70 S 262 30, 292 28"
        className={cn(line, "motion-safe:animate-route")}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="0.5 10"
      />
      {[
        [20, 112],
        [112, 78],
        [206, 70],
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M0 0 C -6 -8 -9 -12 -9 -17 A9 9 0 1 1 9 -17 C 9 -12 6 -8 0 0 Z" className={pin} />
          <circle cx="0" cy="-17" r="3.5" className={hole} />
        </g>
      ))}
      <g transform="translate(286 12) rotate(62 12 12)">
        <path
          d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
          className="fill-ember"
        />
      </g>
    </svg>
  );
}
