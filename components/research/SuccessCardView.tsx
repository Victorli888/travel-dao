import Link from "next/link";
import Card from "@/components/ui/Card";
import Button, { buttonStyles } from "@/components/ui/Button";
import type { ResearchActivity } from "@/lib/types";

interface Props {
  activity: ResearchActivity;
  body: string;
  tripId: string;
  onAddAnother: () => void;
}

/** Pure success view. Receives the saved activity — it does no parsing itself. */
export default function SuccessCardView({
  activity,
  body,
  tripId,
  onAddAnother,
}: Props) {
  return (
    <div className="space-y-3">
      <Card>
        <div className="px-7 py-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
              <span aria-hidden="true" className="text-emerald-400">✓</span>
            </div>
            <p className="text-sm font-semibold text-white">
              Saved to activity bank
            </p>
          </div>

          <div className="rounded-xl border border-accent-bright/15 bg-accent-bright/8 px-4 py-3 mb-5">
            <p className="text-sm font-medium text-accent-pale leading-snug">
              {activity.name}
            </p>
            {activity.area && (
              <p className="mt-1 text-xs text-zinc-400">{activity.area}</p>
            )}
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-3">
              {activity.summary}
            </p>
          </div>

          <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/plan/${tripId}`}
          className={buttonStyles({ variant: "primary" })}
        >
          Back to trip
        </Link>
        <Button variant="quiet" onClick={onAddAnother}>
          Add another place
        </Button>
      </div>
    </div>
  );
}
