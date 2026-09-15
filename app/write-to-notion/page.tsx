import Link from "next/link";
import PageShell from "@/components/ui/PageShell";
import ResearchPanel from "@/components/ResearchPanel";

export default function WriteToNotionPage() {
  return (
    <PageShell>
      <Link
        href="/"
        className="mb-8 inline-block text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        &larr; Travel Tao
      </Link>
      <ResearchPanel />
    </PageShell>
  );
}
