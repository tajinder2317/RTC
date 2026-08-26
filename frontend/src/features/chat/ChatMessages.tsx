import { useEffect, useMemo, useRef } from "react";

type Theme = "dark" | "light";

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
};

type ChatMessagesProps = {
  messages: Message[];
  currentUserId: string;
  theme?: Theme;
};

/* =========================================================
   DATE HELPERS
   ========================================================= */

function getDayKey(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getDate()).padStart(2, "0")}`;
}

function getDayLabel(dateString: string) {
  const date = new Date(dateString);

  const now = new Date();

  const todayKey = getDayKey(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const yesterdayKey = getDayKey(yesterday);

  const messageKey = getDayKey(date);

  if (messageKey === todayKey) {
    return "Today";
  }

  if (messageKey === yesterdayKey) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* =========================================================
   TIME FORMAT
   ========================================================= */

function formatMessageTime(dateString: string) {
  const date = new Date(dateString);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* =========================================================
   MESSAGE BUBBLE
   ========================================================= */

type MessageBubbleProps = {
  text: string;
  createdAt: string;
  isMine: boolean;
  isLatestOutgoingMessage: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
  theme: Theme;
};

function MessageBubble({
  text,
  createdAt,
  isMine,
  isLatestOutgoingMessage,
  deliveredAt,
  readAt,
  theme,
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
    <div className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "relative",
          "max-w-[82%]",
          "rounded-2xl",
          "px-3.5 py-2.5",
          "text-sm",
          "leading-5",
          "shadow-sm",
          "backdrop-blur-xl",
          "sm:max-w-[70%]",
          "transition-colors",
          isMine
            ? [
                "rounded-br-md",
                isDark
                  ? "border border-white/[0.10] bg-white/[0.075] text-white"
                  : "border border-black/[0.08] bg-black/[0.045] text-black",
              ].join(" ")
            : [
                "rounded-bl-md",
                isDark
                  ? "border border-white/[0.08] bg-white/[0.055] text-white"
                  : "border border-black/[0.07] bg-black/[0.035] text-black",
              ].join(" "),
        ].join(" ")}
      >
        {/* MESSAGE + TIME */}

        <div className="flex items-end gap-2">
          <p className="min-w-0 whitespace-pre-wrap break-words">{text}</p>

          {/* TIME */}

          <span
            className={[
              "mb-[1px]",
              "shrink-0",
              "whitespace-nowrap",
              "text-[9px]",
              "leading-none",
              isDark ? "text-white/35" : "text-black/35",
            ].join(" ")}
          >
            {formatMessageTime(createdAt)}
          </span>

          {/* STATUS */}

          {isMine && isLatestOutgoingMessage && (
            <span
              aria-label={readAt ? "Read" : deliveredAt ? "Delivered" : "Sent"}
              className={[
                "mb-[1px]",
                "shrink-0",
                "text-[11px]",
                "font-semibold",
                "leading-none",
                "tracking-[-2px]",
                readAt
                  ? "text-[#53bdeb]"
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

/* =========================================================
   CHAT MESSAGES
   ========================================================= */

export default function ChatMessages({
  messages,
  currentUserId,
  theme = "dark",
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  /*
   * Only the newest outgoing message receives
   * delivery/read status.
   */

  const latestOutgoingMessageId = useMemo(() => {
    return (
      [...messages]
        .reverse()
        .find((message) => message.senderId === currentUserId)?.id ?? null
    );
  }, [messages, currentUserId]);

  /*
   * Auto-scroll whenever messages change.
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  /* =========================================================
     EMPTY STATE
     ========================================================= */

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-6 py-8">
        <div className="max-w-xs text-center">
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border text-lg backdrop-blur-xl ${
              theme === "dark"
                ? "border-white/[0.07] bg-white/[0.04]"
                : "border-black/[0.07] bg-black/[0.035]"
            }`}
          >
            💬
          </div>

          <p
            className={`text-sm font-medium ${
              theme === "dark" ? "text-white" : "text-black"
            }`}
          >
            No messages yet
          </p>

          <p
            className={`mt-1 text-xs ${
              theme === "dark" ? "text-white/40" : "text-black/40"
            }`}
          >
            Say hello and start the conversation.
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     MESSAGES
     ========================================================= */

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2.5 px-3 py-5 sm:px-6">
      {messages.map((message, index) => {
        const isMine = message.senderId === currentUserId;

        const isLatestOutgoingMessage =
          isMine && message.id === latestOutgoingMessageId;

        const previousMessage = messages[index - 1];

        const currentDayKey = getDayKey(message.createdAt);

        const previousDayKey = previousMessage
          ? getDayKey(previousMessage.createdAt)
          : null;

        const showDayDivider = currentDayKey !== previousDayKey;

        return (
          <div key={message.id} className="contents">
            {/* =================================================
                DAY DIVIDER
                ================================================= */}

            {showDayDivider && (
              <div className="my-3 flex items-center justify-center">
                <div
                  className={`rounded-full border px-3 py-1 text-[10px] font-medium shadow-sm backdrop-blur-xl ${
                    theme === "dark"
                      ? "border-white/[0.08] bg-white/[0.045] text-white/40"
                      : "border-black/[0.07] bg-black/[0.035] text-black/40"
                  }`}
                >
                  {getDayLabel(message.createdAt)}
                </div>
              </div>
            )}

            {/* =================================================
                MESSAGE
                ================================================= */}

            <MessageBubble
              text={message.text}
              createdAt={message.createdAt}
              isMine={isMine}
              isLatestOutgoingMessage={isLatestOutgoingMessage}
              deliveredAt={message.deliveredAt}
              readAt={message.readAt}
              theme={theme}
            />
          </div>
        );
      })}

      {/* =====================================================
          AUTO-SCROLL ANCHOR
          ===================================================== */}

      <div
        ref={messagesEndRef}
        aria-hidden="true"
        className="h-px w-full shrink-0"
      />
    </div>
  );
}
