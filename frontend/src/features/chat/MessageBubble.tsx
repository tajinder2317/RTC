type Theme = "dark" | "light";

type MessageBubbleProps = {
  text: string;
  createdAt: string;
  isMine: boolean;
  isLatestOutgoingMessage: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
  theme?: Theme;
};

function formatMessageTime(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function MessageBubble({
  text,
  createdAt,
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

  const messageTime = formatMessageTime(createdAt);

  return (
    <div
      className={`flex w-full ${
        isMine
          ? "justify-end"
          : "justify-start"
      }`}
    >
      <div
        className={[
          "max-w-[82%]",
          "rounded-2xl",
          "px-4 py-2.5",
          "text-sm leading-5",
          "shadow-sm",
          "backdrop-blur-xl",
          "sm:max-w-[70%]",

          isMine
            ? "rounded-br-md"
            : "rounded-bl-md",

          /*
           * DARK MODE
           *
           * Both messages are dark glass.
           */
          isDark
            ? isMine
              ? [
                  "border border-white/[0.10]",
                  "bg-white/[0.095]",
                  "text-white",
                  "shadow-black/20",
                ].join(" ")
              : [
                  "border border-white/[0.07]",
                  "bg-white/[0.055]",
                  "text-white",
                  "shadow-black/20",
                ].join(" ")
            : /*
               * LIGHT MODE
               *
               * Both messages are light gray glass.
               */
              isMine
              ? [
                  "border border-black/[0.08]",
                  "bg-black/[0.055]",
                  "text-[#111827]",
                  "shadow-black/[0.04]",
                ].join(" ")
              : [
                  "border border-black/[0.06]",
                  "bg-black/[0.035]",
                  "text-[#111827]",
                  "shadow-black/[0.03]",
                ].join(" "),
        ].join(" ")}
      >
        {/* MESSAGE */}

        <p className="whitespace-pre-wrap break-words">
          {text}
        </p>

        {/* TIME + STATUS */}

        <div className="mt-1 flex items-center justify-end gap-1.5">
          <span
            className={`text-[9px] font-medium leading-none ${
              isDark
                ? "text-white/30"
                : "text-black/35"
            }`}
          >
            {messageTime}
          </span>

          {isMine &&
            isLatestOutgoingMessage && (
              <span
                aria-label={
                  readAt
                    ? "Read"
                    : deliveredAt
                      ? "Delivered"
                      : "Sent"
                }
                className={`text-[10px] font-semibold leading-none tracking-[-1px] ${
                  readAt
                    ? "text-[#53b7ff]"
                    : isDark
                      ? "text-white/45"
                      : "text-black/40"
                }`}
              >
                {messageStatus}
              </span>
            )}
        </div>
      </div>
    </div>
  );
}