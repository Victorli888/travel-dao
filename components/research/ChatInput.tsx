"use client";

import ChatInputView from "./ChatInputView";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import { useRotatingIndex } from "@/hooks/useRotatingIndex";
import { PLACE_EXAMPLES } from "@/lib/constants";
import { useState } from "react";

interface Props {
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

/**
 * Container for input-local concerns only: the draft text, the auto-growing
 * textarea, and the rotating example placeholder. Request state lives in
 * ResearchPanel.
 */
export default function ChatInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useAutoResizeTextarea(value);
  const { index, visible } = useRotatingIndex(PLACE_EXAMPLES.length);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <ChatInputView
      value={value}
      onChange={setValue}
      onSubmit={handleSubmit}
      placeholder={visible ? PLACE_EXAMPLES[index] : ""}
      textareaRef={textareaRef}
      disabled={disabled}
    />
  );
}
