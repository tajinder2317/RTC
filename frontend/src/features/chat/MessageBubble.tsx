type Theme = "dark" | "light";

type MessageBubbleProps = {
  text: string;
  isMine: boolean;
  isLatestOutgoingMessage: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
  theme?: Theme;
};

export default function MessageBubble({
  text,
  isMine,
  isLatestOutgoingMessage,
  deliveredAt,
  readAt,
  theme = "dark",
}: MessageBubbleProps) {
  const isDark = theme === "dark";

  /*
   * Message status
   *
   * ✓   = sent
   * ✓✓  = delivered
   * ✓✓  = read
   */

  let messageStatus = "✓";

  if (deliveredAt) {
    messageStatus = "✓✓";
  }

  if (readAt) {
    messageStatus = "✓✓";
  }

  return (
    <div
      className={`flex w-full ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={[
          "max-w-[82%]",
          "rounded-2xl",
          "px-4 py-2.5",
          "text-sm leading-5",
          "shadow-sm",
          "sm:max-w-[70%]",
          isMine
            ? isDark
              ? [
                  "rounded-br-md",
                  "bg-white",
                  "text-black",
                ].join(" ")
              : [
                  "rounded-br-md",
                  "bg-white",
                  "text-black",
                  "border border-black/[0.06]",
                ].join(" ")
            : isDark
              ? [
                  "rounded-bl-md",
                  "border border-white/[0.06]",
                  "bg-[#181818]",
                  "text-white",
                ].join(" ")
              : [
                  "rounded-bl-md",
                  "border border-black/[0.06]",
                  "bg-white",
                  "text-black",
                ].join(" "),
        ].join(" ")}
      >
        {/* MESSAGE */}

        <p className="whitespace-pre-wrap break-words">
          {text}
        </p>

        {/* STATUS */}

        {isMine && isLatestOutgoingMessage && (
          <div
            className={[
              "mt-1",
              "flex justify-end",
              "text-[10px]",
              "font-medium",
              "leading-none",
              readAt
                ? isDark
                  ? "text-blue-500"
                  : "text-blue-600"
                : isDark
                  ? "text-black/40"
                  : "text-black/40",
            ].join(" ")}
          >
            {messageStatus}
          </div>
        )}
      </div>
    </div>
  );
}