import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { CheckIcon, PathIcon } from "@/components/ui/icons";

interface Props {
  /** Notion breadcrumb, already parsed. Hidden when null. */
  path: string | null;
  body: string;
  onAddAnother: () => void;
}

/** Pure success view. Receives parsed values — it does no parsing itself. */
export default function SuccessCardView({ path, body, onAddAnother }: Props) {
  return (
    <div className="space-y-3">
      <Card accentBar>
        <div className="px-7 py-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
              <CheckIcon className="text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-white">Saved to Notion</p>
          </div>

          {path && (
            <div className="flex items-center gap-2 bg-accent-bright/8 border border-accent-bright/15 rounded-xl px-4 py-3 mb-5">
              <PathIcon className="text-accent-light flex-shrink-0" />
              <p className="text-xs text-accent-pale font-mono leading-relaxed">
                {path}
              </p>
            </div>
          )}

          <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
        </div>
      </Card>

      <Button variant="ghost" size="block" fullWidth onClick={onAddAnother}>
        Add Another Place
      </Button>
    </div>
  );
}
