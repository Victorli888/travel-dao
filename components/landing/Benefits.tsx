import { eyebrow, sectionHeading } from "@/components/landing/styles";

/** 24px line icons, stroked in `currentColor` so the parent sets the token. */
const ICONS = {
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  bookmark: (
    <path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" />
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
};

const BENEFITS: Array<{
  icon: keyof typeof ICONS;
  title: string;
  body: string;
}> = [
  {
    icon: "calendar",
    title: "Every day, laid out",
    body: "Set a departure and a return date and get a column for every day between them. No spreadsheet, and no day you forgot to plan.",
  },
  {
    icon: "bookmark",
    title: "One home for your wishlist",
    body: "Every activity you save stays with its trip in the Activity Bank, scheduled or not. Search it by name or neighbourhood, accents optional.",
  },
  {
    icon: "compass",
    title: "Research done for you",
    body: "Give Travel Tao a place and its address. A Claude agent checks what is really there, sums it up, and saves it to the trip's activity bank.",
  },
];

export default function Benefits() {
  return (
    <section aria-labelledby="benefits-heading" className="py-20 sm:py-24">
      <div className="max-w-[40rem]">
        <p className={eyebrow}>Why Travel Tao</p>
        <h2 id="benefits-heading" className={sectionHeading}>
          Less juggling. More travelling.
        </h2>
      </div>

      <ul className="m-0 mt-12 grid list-none gap-5 p-0 md:grid-cols-3 md:gap-6">
        {BENEFITS.map((benefit) => (
          <li
            key={benefit.title}
            className="rounded-3xl border border-rule/70 bg-paper p-7 transition-colors hover:border-sky"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky/20 text-tao">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[benefit.icon]}
              </svg>
            </span>
            <h3 className="m-0 mt-6 text-[18px] font-semibold tracking-tight text-ink">
              {benefit.title}
            </h3>
            <p className="m-0 mt-2 text-[15px] leading-relaxed text-ink-muted">
              {benefit.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
