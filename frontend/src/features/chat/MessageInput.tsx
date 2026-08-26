import {
  FormEvent,
  useRef,
  useState,
} from "react";

type Theme = "dark" | "light";

type MessageInputProps = {
  onSend: (text: string) => void;
  theme?: Theme;
};

const MAX_MESSAGE_LENGTH = 2000;
const MAX_TEXTAREA_HEIGHT = 120;

export default function MessageInput({
  onSend,
  theme = "dark",
}: MessageInputProps) {
  const [text, setText] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isDark = theme === "dark";
  const hasText = text.trim().length > 0;

  /* =========================================================
     RESET TEXTAREA HEIGHT
     ========================================================= */

  const resetTextareaHeight = () => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";
  };

  /* =========================================================
     FOCUS TEXTAREA
     ========================================================= */

  const focusTextarea = () => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  const sendCurrentMessage = () => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    onSend(trimmedText);

    setText("");

    resetTextareaHeight();
    focusTextarea();
  };

  /* =========================================================
     FORM SUBMIT
     ========================================================= */

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    sendCurrentMessage();
  };

  /* =========================================================
     TEXT CHANGE
     ========================================================= */

  const handleChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const textarea = event.target;

    setText(textarea.value);

    /*
     * Reset first so the textarea can shrink
     * when text is deleted.
     */
    textarea.style.height = "auto";

    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      MAX_TEXTAREA_HEIGHT,
    )}px`;
  };

  /* =========================================================
     KEYBOARD
     ========================================================= */

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    /*
     * Enter = send
     * Shift + Enter = new line
     */
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();

      if (!hasText) {
        return;
      }

      sendCurrentMessage();
    }
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        "flex w-full items-end gap-2",
        "rounded-2xl border p-2",
        "transition-colors duration-200",

        isDark
          ? [
              "border-white/[0.08]",
              "bg-[#111214]",
              "shadow-lg shadow-black/20",
            ].join(" ")
          : [
              "border-black/[0.08]",
              "bg-white",
              "shadow-lg shadow-black/10",
            ].join(" "),
      ].join(" ")}
    >
      {/* =====================================================
          TEXTAREA
          ===================================================== */}

      <div className="min-w-0 flex-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Type a message..."
          aria-label="Message"
          className={[
            "block w-full resize-none",
            "min-h-[42px] max-h-[120px]",
            "overflow-y-auto",
            "bg-transparent",
            "px-3 py-2.5",
            "text-[14px] leading-5",
            "outline-none",
            "transition-colors",

            isDark
              ? [
                  "text-white",
                  "placeholder:text-white/30",
                  "selection:bg-white/20",
                ].join(" ")
              : [
                  "text-black",
                  "placeholder:text-black/30",
                  "selection:bg-black/10",
                ].join(" "),
          ].join(" ")}
        />
      </div>

      {/* =====================================================
          SEND BUTTON
          ===================================================== */}

      <button
        type="submit"
        disabled={!hasText}
        aria-label="Send message"
        title={hasText ? "Send message" : "Type a message first"}
        className={[
          "flex h-10 w-10 shrink-0",
          "items-center justify-center",
          "rounded-xl",
          "transition-all duration-200",

          hasText
            ? isDark
              ? [
                  "bg-white text-black",
                  "shadow-md shadow-white/10",
                  "hover:bg-white/90",
                  "active:scale-95",
                ].join(" ")
              : [
                  "bg-black text-white",
                  "shadow-md shadow-black/10",
                  "hover:bg-black/80",
                  "active:scale-95",
                ].join(" ")
            : isDark
              ? [
                  "cursor-not-allowed",
                  "bg-white/[0.06]",
                  "text-white/20",
                ].join(" ")
              : [
                  "cursor-not-allowed",
                  "bg-black/[0.05]",
                  "text-black/20",
                ].join(" "),
        ].join(" ")}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
          aria-hidden="true"
        >
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      </button>
    </form>
  );
}