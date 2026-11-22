/**
 * The hero's travel visual: a dotted route linking three pins and ending in a
 * plane, with a day card laid over it in the shape the planner's own day
 * column takes. Pure markup and inline SVG, no image request.
 *
 * The example stops are illustration, not data, so the whole figure is one
 * `role="img"` with a written description and its parts are hidden from
 * assistive tech. Motion is `motion-safe:` only.
 */

const STOPS = [
  { name: "Fushimi Inari", area: "Fushimi" },
  { name: "Nishiki Market", area: "Nakagyō" },
  { name: "Dinner by the river", area: "Pontochō" },
];

/**
 * Pin points in the SVG's 500×400 space, in route order. On a phone the frame
 * goes square and the drawing pins to the top, so the day card sits below the
 * route instead of over it.
 */
const PINS = [
  { x: 64, y: 292 },
  { x: 156, y: 168 },
  { x: 282, y: 126 },
];

const ROUTE =
  "M64 292 C 92 232, 112 190, 156 168 S 236 116, 282 126 S 372 104, 418 70";

function Pin({ x, y, label }: { x: number; y: number; label: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="9" ry="3" className="fill-tao/15" />
      <path
        d="M0 0 C -8 -11 -13 -17 -13 -25 A13 13 0 1 1 13 -25 C 13 -17 8 -11 0 0 Z"
        className="fill-tao"
      />
      <circle cx="0" cy="-25" r="7.5" className="fill-paper" />
      <text
        x="0"
        y="-21.5"
        textAnchor="middle"
        className="fill-tao text-[10px] font-semibold"
      >
        {label}
      </text>
    </g>
  );
}

export default function RouteIllustration() {
  return (
    <div
      role="img"
      aria-label="Illustration: a dotted travel route links three map pins and ends at a small plane, beside a card for Day 1 listing three stops in Kyoto."
      className="relative mx-auto w-full max-w-[34rem]"
    >
      <div
        aria-hidden="true"
        className="relative aspect-square overflow-hidden sm:aspect-[5/4] rounded-[2rem] border border-sky/40 bg-sky/10"
      >
        <svg
          viewBox="0 0 500 400"
          preserveAspectRatio="xMidYMin meet"
          className="absolute inset-0 h-full w-full"
          fill="none"
        >
          {/* Faint contour lines, a map's terrain without a real place. */}
          <g className="stroke-sky" strokeWidth="1.25" opacity="0.55">
            <path d="M-20 110 C 80 70, 160 140, 260 96 S 420 40, 520 80" />
            <path d="M-20 160 C 90 120, 170 196, 280 150 S 430 96, 520 132" />
            <path d="M-20 360 C 100 320, 200 380, 320 336 S 460 300, 520 320" />
          </g>
          <circle cx="430" cy="300" r="58" className="stroke-sky" strokeWidth="1.25" opacity="0.5" />
          <circle cx="430" cy="300" r="34" className="stroke-sky" strokeWidth="1.25" opacity="0.5" />

          {/* The route: round-capped dashes read as dots. */}
          <path
            d={ROUTE}
            className="stroke-tao motion-safe:animate-route"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="0.5 11.5"
          />

          {PINS.map((pin, i) => (
            <Pin key={i} x={pin.x} y={pin.y} label={i + 1} />
          ))}

          {/* The plane, rotated to fly along the route's last leg. */}
          <g transform="translate(406 42) rotate(52 14 14)">
            <g className="motion-safe:animate-drift">
              <path
                transform="scale(1.2)"
                d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                className="fill-ember"
              />
            </g>
          </g>
        </svg>

        {/* A day column in miniature, the planner's own shape. */}
        <div className="absolute bottom-4 right-4 w-[min(62%,17rem)] rounded-2xl border border-rule bg-paper p-4 shadow-[0_18px_40px_-20px] shadow-tao/35 sm:bottom-6 sm:right-6 sm:p-5">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-tao">
            Day 1
          </p>
          <p className="m-0 mt-0.5 text-[15px] font-semibold text-ink">
            Sat, Apr 12
          </p>
          <ol className="m-0 mt-3 list-none space-y-2.5 p-0">
            {STOPS.map((stop, i) => (
              <li key={stop.name} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tao text-[10px] font-semibold text-paper">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {stop.name}
                  </span>
                  <span className="block text-[12px] text-ink-subtle">
                    {stop.area}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
