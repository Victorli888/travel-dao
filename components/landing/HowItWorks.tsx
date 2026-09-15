const STEPS = [
  {
    action: "Find",
    title: "Find activities you enjoy",
    body: "Search by name, or pull in what you already saved. A place needs its name and its neighbourhood; everything else fills itself in.",
  },
  {
    action: "Create",
    title: "Create a trip",
    body: "Name it and set the dates. Travel Tao lays out a column for every day between them, waiting to be filled.",
  },
  {
    action: "Add",
    title: "Add the activities",
    body: "Six pins on a map tell you in a second whether the day doubles back across the city. Drop what does not belong before you spend a morning on it.",
  },
  {
    action: "Plan",
    title: "Let Travel Tao work out the best path",
    body: "Opening hours, meal times, a booking you cannot move, and how long it takes to get between them. Adjust any stop and the rest shift with it.",
  },
];

/**
 * The four steps sit on the spine the planner's own timeline uses, with the
 * verb where a start time would be — the order matters, so the structure says
 * so without numbering it.
 */
export default function HowItWorks() {
  return (
    <section className="py-14 sm:py-20">
      <h2 className="m-0 mb-9 max-w-[24ch] text-[clamp(1.5rem,3.4vw,2rem)] font-medium leading-tight tracking-[-0.02em] text-ink">
        Four moves from a list of places to a day you can follow.
      </h2>

      <ol className="m-0 list-none p-0">
        {STEPS.map((step) => (
          <li
            key={step.action}
            className="group grid grid-cols-[52px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[62px_minmax(0,1fr)] sm:gap-x-5"
          >
            <span className="pt-[3px] text-right text-[13px] font-medium text-tao">
              {step.action}
            </span>
            <div className="relative border-l border-rule pb-7 pl-5 group-last:border-transparent group-last:pb-0 sm:pl-6">
              <span className="absolute -left-[4px] top-[9px] h-2 w-2 rounded-full bg-tao" />
              <h3 className="m-0 text-[17px] font-medium leading-snug tracking-tight text-ink">
                {step.title}
              </h3>
              <p className="m-0 mt-1.5 max-w-[58ch] text-[15px] leading-relaxed text-ink-muted">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
