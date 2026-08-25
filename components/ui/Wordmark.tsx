interface Props {
  /** Optional tagline rendered beneath the mark. */
  tagline?: React.ReactNode;
}

/** The "Dao 道" brand lockup. */
export default function Wordmark({ tagline }: Props) {
  return (
    <div className="text-center">
      <h1 className="flex items-baseline justify-center gap-3 text-4xl font-bold text-white tracking-tight">
        Dao
        <span className="text-3xl font-normal text-accent-light/70">道</span>
      </h1>
      {tagline && (
        <p className="mt-3 text-zinc-400 text-sm leading-relaxed">{tagline}</p>
      )}
    </div>
  );
}
