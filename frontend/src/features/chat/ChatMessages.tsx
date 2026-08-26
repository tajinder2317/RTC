import { useEffect, useMemo, useRef } from "react";

import MessageBubble from "./MessageBubble";

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

/*
 * =========================================================
 * DATE HELPERS
 * =========================================================
 */

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getDayLabel(dateString: string): string {
  const date = new Date(dateString);

  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year:
      date.getFullYear() === today.getFullYear()
        ? undefined
        : "numeric",
  });
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export default function ChatMessages({
  messages,
  currentUserId,
  theme = "dark",
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isDark = theme === "dark";

  /*
   * =========================================================
   * LATEST OUTGOING MESSAGE
   * =========================================================
   *
   * Only the newest outgoing message receives
   * delivery/read status.
   */

  const latestOutgoingMessageId = useMemo(() => {
    return (
      [...messages]
        .reverse()
        .find(
          (message) => message.senderId === currentUserId,
        )?.id ?? null
    );
  }, [messages, currentUserId]);

  /*
   * =========================================================
   * AUTO SCROLL
   * =========================================================
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  /*
   * =========================================================
   * EMPTY STATE
   * =========================================================
   */

  if (messages.length === 0) {
    return (
      <div
        className={`flex h-full min-h-0 items-center justify-center px-6 py-8 ${
          isDark ? "text-white" : "text-black"
        }`}
      >
        <div className="max-w-xs text-center">
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-lg ${
              isDark
                ? "border border-white/[0.06] bg-white/[0.04]"
                : "border border-black/[0.06] bg-black/[0.035]"
            }`}
          >
            💬
          </div>

          <p
            className={`text-sm font-medium ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            No messages yet
          </p>

          <p
            className={`mt-1 text-xs ${
              isDark ? "text-white/40" : "text-black/40"
            }`}
          >
            Say hello and start the conversation.
          </p>
        </div>
      </div>
    );
  }

  /*
   * =========================================================
   * MESSAGES
   * =========================================================
   */

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-3 py-5 sm:px-6">
      {messages.map((message, index) => {
        const previousMessage = messages[index - 1];

        const currentDate = new Date(message.createdAt);

        const previousDate = previousMessage
          ? new Date(previousMessage.createdAt)
          : null;

        const shouldShowDayDivider =
          !previousDate ||
          !isSameDay(currentDate, previousDate);

        const isMine = message.senderId === currentUserId;

        const isLatestOutgoingMessage =
          isMine &&
          message.id === latestOutgoingMessageId;

        return (
          <div key={message.id}>
            {/* DAY DIVIDER */}

            {shouldShowDayDivider && (
              <div className="my-5 flex items-center gap-3">
                <div
                  className={`h-px flex-1 ${
                    isDark
                      ? "bg-white/[0.06]"
                      : "bg-black/[0.06]"
                  }`}
                />

                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-[9px] font-medium tracking-wide ${
                    isDark
                      ? "border-white/[0.07] bg-white/[0.035] text-white/35"
                      : "border-black/[0.07] bg-black/[0.025] text-black/40"
                  }`}
                >
                  {getDayLabel(message.createdAt)}
                </span>

                <div
                  className={`h-px flex-1 ${
                    isDark
                      ? "bg-white/[0.06]"
                      : "bg-black/[0.06]"
                  }`}
                />
              </div>
            )}

            {/* MESSAGE */}

            <div className="mb-2.5">
              <MessageBubble
                text={message.text}
                isMine={isMine}
                isLatestOutgoingMessage={
                  isLatestOutgoingMessage
                }
                deliveredAt={message.deliveredAt}
                readAt={message.readAt}
                createdAt={message.createdAt}
                theme={theme}
              />
            </div>
          </div>
        );
      })}

      {/* AUTO-SCROLL ANCHOR */}

      <div
        ref={messagesEndRef}
        aria-hidden="true"
        className="h-px w-full shrink-0"
      />
    </div>
  );
}