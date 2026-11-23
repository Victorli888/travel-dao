import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { KeyboardEvent, RefObject } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
}

/** Pure input surface. Holds no state and knows nothing about the API. */
export default function ChatInputView({
  value,
  onChange,
  onSubmit,
  placeholder,
  textareaRef,
  disabled = false,
}: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="space-y-2">
      <Card className="transition-all duration-200 focus-within:border-accent-bright/50 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.1)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={disabled}
          className="w-full px-5 pt-4 pb-2 text-sm text-zinc-100 focus:outline-none resize-none overflow-hidden leading-relaxed bg-transparent placeholder:text-zinc-600"
          placeholder={placeholder}
        />
        <div className="flex items-center justify-between px-4 pb-3.5 pt-1">
          <p className="text-xs text-zinc-600">
            Enter to submit · Shift+Enter for new line
          </p>
          <Button size="sm" onClick={onSubmit} disabled={disabled || !value.trim()}>
            Add to bank
          </Button>
        </div>
      </Card>

      <p className="text-xs text-zinc-600 px-1">
        Format: <span className="text-zinc-500">Place name, full address</span>
      </p>
    </div>
  );
}
