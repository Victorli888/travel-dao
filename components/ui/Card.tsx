import { cn } from "@/lib/cn";

interface Props {
  children: React.ReactNode;
  /** Renders the purple gradient hairline across the top edge. */
  accentBar?: boolean;
  className?: string;
}

/** The app's single surface treatment: rounded, hairline-bordered panel. */
export default function Card({ children, accentBar = false, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface overflow-hidden",
        className
      )}
    >
      {accentBar && (
        <div className="h-0.5 bg-gradient-to-r from-accent via-violet-400 to-transparent" />
      )}
      {children}
    </div>
  );
}
