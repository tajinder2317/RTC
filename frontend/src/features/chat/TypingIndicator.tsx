type TypingIndicatorProps = {
  username: string;
};

export default function TypingIndicator({
  username,
}: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5">
      <span className="text-xs text-black/40 dark:text-white/40">
        {username} is typing
      </span>

      <span
        className="animate-bounce text-[10px] text-black/40 dark:text-white/40 [animation-delay:-0.3s]"
        aria-hidden="true"
      >
        •
      </span>

      <span
        className="animate-bounce text-[10px] text-black/40 dark:text-white/40 [animation-delay:-0.15s]"
        aria-hidden="true"
      >
        •
      </span>

      <span
        className="animate-bounce text-[10px] text-black/40 dark:text-white/40"
        aria-hidden="true"
      >
        •
      </span>
    </div>
  );
}