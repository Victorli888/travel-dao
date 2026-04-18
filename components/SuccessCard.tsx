interface Props {
  message: string;
  onAddAnother: () => void;
}

export default function SuccessCard({ message, onAddAnother }: Props) {
  // Extract the Notion path if Claude included one (e.g. "Kyoto > Good Eats > Dessert > …")
  const pathMatch = message.match(/([A-Za-z\u3000-\u9fff\s&]+(?:\s*>\s*[A-Za-z\u3000-\u9fff\s&]+){2,})/);
  const path = pathMatch?.[0].trim();
  const body = path ? message.replace(path, "").replace(/[`'"]/g, "").trim() : message;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-[#13131f] overflow-hidden">
        {/* Top accent bar */}
        <div className="h-0.5 bg-gradient-to-r from-purple-600 via-violet-400 to-transparent" />

        <div className="px-7 py-7">
          {/* Icon + headline */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">Saved to Notion</p>
          </div>

          {/* Notion path */}
          {path && (
            <div className="flex items-center gap-2 bg-purple-500/8 border border-purple-500/15 rounded-xl px-4 py-3 mb-5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-purple-400 flex-shrink-0">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
              </svg>
              <p className="text-xs text-purple-300 font-mono leading-relaxed">{path}</p>
            </div>
          )}

          {/* Claude's reply text */}
          <p className="text-sm text-zinc-400 leading-relaxed">{body || message}</p>
        </div>
      </div>

      <button
        onClick={onAddAnother}
        className="w-full py-3 rounded-xl border border-white/10 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer"
      >
        Add Another Place
      </button>
    </div>
  );
}
