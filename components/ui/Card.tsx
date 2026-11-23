import { cn } from "@/lib/cn";

interface Props {
  children: React.ReactNode;
  className?: string;
}

/** The app's single surface treatment: rounded, hairline-bordered panel. */
export default function Card({ children, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
