import { useEffect, useMemo, useRef } from "react";

import MessageBubble from "./MessageBubble";

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
};

export default function ChatMessages({
  messages,
  currentUserId,
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

  /*
   * EMPTY STATE
   */
  if (messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-6 py-8">
        <div className="max-w-xs text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-black/[0.04] text-lg dark:bg-white/[0.04]">
            💬
          </div>

          <p className="text-sm font-medium text-black dark:text-white">
            No messages yet
          </p>

          <p className="mt-1 text-xs text-black/40 dark:text-white/45">
            Say hello and start the conversation.
          </p>
        </div>
      </div>
    );
  }

  /*
   * MESSAGES
   */
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2.5 px-3 py-5 sm:px-6">
      {messages.map((message) => {
        const isMine = message.senderId === currentUserId;

        const isLatestOutgoingMessage =
          isMine && message.id === latestOutgoingMessageId;

        return (
          <MessageBubble
            key={message.id}
            text={message.text}
            isMine={isMine}
            isLatestOutgoingMessage={isLatestOutgoingMessage}
            deliveredAt={message.deliveredAt}
            readAt={message.readAt}
          />
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
