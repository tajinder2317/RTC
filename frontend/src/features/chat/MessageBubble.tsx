type Theme = "dark" | "light";

type MessageBubbleProps = {
  text: string;
  isMine: boolean;
  isLatestOutgoingMessage: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  theme?: Theme;
};

export default function MessageBubble({
  text,
  isMine,
  isLatestOutgoingMessage,
  deliveredAt,
  readAt,
  createdAt,
  theme = "dark",
}: MessageBubbleProps) {
  const isDark = theme === "dark";

  /*
   * =========================================================
   * MESSAGE STATUS
   * =========================================================
   *
   * ✓   = sent
   * ✓✓  = delivered
   * ✓✓  = read
   *
   * Only the latest outgoing message displays the status.
   */

  let messageStatus = "✓";

  if (deliveredAt) {
    messageStatus = "✓✓";
  }

  if (readAt) {
    messageStatus = "✓✓";
  }

  /*
   * =========================================================
   * TIME
   * =========================================================
   */

  const formattedTime = new Date(createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex w-full ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={[
          "group",
          "max-w-[82%]",
          "rounded-2xl",
          "px-3.5 py-2.5",
          "text-sm",
          "leading-5",
          "shadow-sm",
          "backdrop-blur-md",
          "transition-colors",
          "sm:max-w-[70%]",

          /*
           * =================================================
           * MY MESSAGE
           * =================================================
           */

          isMine
            ? isDark
              ? [
                  "rounded-br-md",
                  "border border-white/[0.10]",
                  "bg-white/[0.09]",
                  "text-white",
                  "shadow-black/20",
                ].join(" ")
              : [
                  "rounded-br-md",
                  "border border-black/[0.08]",
                  "bg-black/[0.045]",
                  "text-black",
                  "shadow-black/[0.04]",
                ].join(" ")

            /*
             * =================================================
             * OTHER USER MESSAGE
             * =================================================
             */

            : isDark
              ? [
                  "rounded-bl-md",
                  "border border-white/[0.07]",
                  "bg-white/[0.055]",
                  "text-white",
                  "shadow-black/20",
                ].join(" ")
              : [
                  "rounded-bl-md",
                  "border border-black/[0.07]",
                  "bg-black/[0.035]",
                  "text-black",
                  "shadow-black/[0.035]",
                ].join(" "),
        ].join(" ")}
      >
        {/* MESSAGE TEXT */}

        <p className="whitespace-pre-wrap break-words">
          {text}
        </p>

        {/* META */}

        <div
          className={[
            "mt-1",
            "flex",
            "items-center",
            "justify-end",
            "gap-1.5",
            "select-none",
          ].join(" ")}
        >
          {/* TIME */}

          <span
            className={`text-[9px] font-medium leading-none ${
              isDark ? "text-white/35" : "text-black/35"
            }`}
          >
            {formattedTime}
          </span>

          {/* WHATSAPP-STYLE STATUS */}

          {isMine && isLatestOutgoingMessage && (
            <span
              aria-label={
                readAt
                  ? "Read"
                  : deliveredAt
                    ? "Delivered"
                    : "Sent"
              }
              className={[
                "text-[10px]",
                "font-semibold",
                "leading-none",
                "tracking-[-2px]",
                readAt
                  ? "text-blue-400"
                  : isDark
                    ? "text-white/45"
                    : "text-black/40",
              ].join(" ")}
            >
              {messageStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}