"use client";

import { useState } from "react";
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
    <main className="min-h-screen flex flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-xl">
        {status !== "success" && (
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium px-3 py-1 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              Powered by AI
            </div>
            <h1 className="flex items-baseline justify-center gap-3 text-4xl font-bold text-white tracking-tight">
              Dao
              <span className="text-3xl font-normal text-purple-400/70">道</span>
            </h1>
            <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
              Describe any place you want to visit.<br />
              I'll research it and organize it in Notion.
            </p>
          </div>
        )}

        {status === "loading" ? (
          <LoadingState />
        ) : status === "success" && message ? (
          <SuccessCard message={message} onAddAnother={handleReset} />
        ) : (
          <ChatInput onSubmit={handleSubmit} error={error} />
        )}
      </div>
    </main>
  );
}
