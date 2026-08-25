interface Props {
  message: string;
}

/** Inline failure notice. Rendered by orchestrators, never by inputs. */
export default function ErrorBanner({ message }: Props) {
  return (
    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">
      <span className="font-medium">Error: </span>
      {message}
    </div>
  );
}
