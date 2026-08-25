"use client";

import Wordmark from "@/components/ui/Wordmark";
import ErrorBanner from "@/components/ui/ErrorBanner";
import ChatInput from "@/components/research/ChatInput";
import ResearchProgress from "@/components/research/ResearchProgress";
import SuccessCardView from "@/components/research/SuccessCardView";
import { useResearch } from "@/hooks/useResearch";
import { parseNotionPath } from "@/lib/research/parse-reply";

/**
 * The app's only stateful orchestrator: owns the request lifecycle, decides
 * which view is on screen, and does the one bit of data shaping the success
 * view needs. Every component below this one is presentational.
 */
export default function ResearchPanel() {
  const { state, submit, reset } = useResearch();

  if (state.status === "success") {
    const { path, body } = parseNotionPath(state.message);
    return <SuccessCardView path={path} body={body} onAddAnother={reset} />;
  }

  return (
    <>
      <div className="mb-10">
        <Badge />
        <Wordmark
          tagline={
            <>
              Describe any place you want to visit.
              <br />
              I&apos;ll research it and organize it in Notion.
            </>
          }
        />
      </div>

      {state.status === "loading" ? (
        <ResearchProgress />
      ) : (
        <div className="space-y-2">
          {state.status === "error" && <ErrorBanner message={state.error} />}
          <ChatInput onSubmit={submit} />
        </div>
      )}
    </>
  );
}

function Badge() {
  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2 bg-accent-bright/10 border border-accent-bright/20 text-accent-pale text-xs font-medium px-3 py-1 rounded-full mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
        Powered by AI
      </div>
    </div>
  );
}
