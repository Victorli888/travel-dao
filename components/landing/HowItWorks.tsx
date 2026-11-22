import { cn } from "@/lib/cn";
import { container, eyebrow, sectionHeading } from "@/components/landing/styles";

const STEPS = [
  {
    title: "Name your trip",
    body: "Give it a name, then set your departure and return dates.",
  },
  {
    title: "Open your days",
    body: "Every date between them gets its own column, waiting to be filled.",
  },
  {
    title: "Gather what to see",
    body: "Keep the places you want in the trip's Activity Bank, then shape each day around them.",
  },
];

/**
 * Three numbered stops on one dotted route: across on wide screens, down on
 * narrow ones. The order matters, so it is an `<ol>`.
 */
export default function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="border-y border-sky/30 bg-sky/10 py-20 sm:py-24"
    >
      <div className={container}>
        <div className="max-w-[40rem]">
          <p className={eyebrow}>How it works</p>
          <h2 id="how-heading" className={sectionHeading}>
            From two dates to a trip you can follow.
          </h2>
        </div>

        <ol className="m-0 mt-14 grid list-none gap-0 p-0 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0 md:block md:pb-0"
            >
              {/* The dotted leg to the next stop. */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute border-dashed border-tao/35",
                    "left-6 top-12 bottom-0 border-l-2",
                    "md:left-16 md:right-[-2rem] md:top-6 md:bottom-auto md:border-l-0 md:border-t-2",
                  )}
                />
              )}
              <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-tao bg-paper text-[17px] font-semibold text-tao">
                {i + 1}
              </span>
              <div className="pt-2 md:pt-6">
                <h3 className="m-0 text-[19px] font-semibold tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="m-0 mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ink-muted">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
