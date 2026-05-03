"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface Props {
  onSubmit: (message: string) => void;
  error: string | null;
}

const EXAMPLES = [
  "Tokyo Tower, 4 Chome-2-8 Shibakoen, Minato City, Tokyo 105-0011, Japan",
  "Patisserie Rau, 169 Higashiyama, Yamashina Ward, Kyoto 607-8322, Japan",
  "Blue Lagoon, 240 Grindavíkurvegur, 240 Grindavík, Iceland",
];

export default function ChatInput({ onSubmit, error }: Props) {
  const [value, setValue] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [exampleVisible, setExampleVisible] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setExampleVisible(false);
      setTimeout(() => {
        setExampleIndex((i) => (i + 1) % EXAMPLES.length);
        setExampleVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-300">
          <span className="font-medium">Error: </span>
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#13131f] overflow-hidden transition-all duration-200 focus-within:border-purple-500/50 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.1)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="w-full px-5 pt-4 pb-2 text-sm text-zinc-100 focus:outline-none resize-none overflow-hidden leading-relaxed bg-transparent placeholder:text-zinc-600"
          placeholder={exampleVisible ? EXAMPLES[exampleIndex] : ""}
        />
        <div className="flex items-center justify-between px-4 pb-3.5 pt-1">
          <p className="text-xs text-zinc-600">Enter to submit · Shift+Enter for new line</p>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Save to Notion
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-600 px-1">
        Format: <span className="text-zinc-500">Place name, full address</span>
      </p>
    </div>
  );
}
