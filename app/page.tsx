"use client";

import { useState } from "react";
import PageShell from "@/components/ui/PageShell";
import Wordmark from "@/components/ui/Wordmark";
import ChatInput from "@/components/ChatInput";
import LoadingState from "@/components/LoadingState";
import SuccessCard from "@/components/SuccessCard";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (message: string) => {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Something went wrong");
      }

      setMessage(json.message);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setMessage(null);
    setError(null);
  };

  return (
    <PageShell>
      {status !== "success" && (
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-accent-bright/10 border border-accent-bright/20 text-accent-pale text-xs font-medium px-3 py-1 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
            Powered by AI
          </div>
          <Wordmark
            tagline={
              <>
                Describe any place you want to visit.
                <br />
                I'll research it and organize it in Notion.
              </>
            }
          />
        </div>
      )}

      {status === "loading" ? (
        <LoadingState />
      ) : status === "success" && message ? (
        <SuccessCard message={message} onAddAnother={handleReset} />
      ) : (
        <ChatInput onSubmit={handleSubmit} error={error} />
      )}
    </PageShell>
  );
}
