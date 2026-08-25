import { cn } from "@/lib/cn";

const WIDTHS = {
  sm: "max-w-sm",
  xl: "max-w-xl",
} as const;

interface Props {
  children: React.ReactNode;
  /** Content column width. `sm` for auth pages, `xl` for the research panel. */
  width?: keyof typeof WIDTHS;
}

/** Full-height centered page frame shared by every route. */
export default function PageShell({ children, width = "xl" }: Props) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-16 px-4">
      <div className={cn("w-full", WIDTHS[width])}>{children}</div>
    </main>
  );
}
