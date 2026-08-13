import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../auth/authStore";
import { useChatStore } from "./chatStore";
import { socket } from "../../services/socket";

type Theme = "dark" | "light";

type MessageInputProps = {
  onSend: (message: string) => void;
  theme?: Theme;
};

export default function MessageInput({
  onSend,
  theme = "dark",
}: MessageInputProps) {
  const [message, setMessage] = useState("");

  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const conversationId = useChatStore(
    (state) => state.currentConversationId,
  );

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isTypingRef = useRef(false);

  const stopTyping = () => {
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }

    if (
      !conversationId ||
      !currentUser ||
      !isTypingRef.current
    ) {
      return;
    }

    socket.emit("stopTyping", {
      conversationId,
      userId: currentUser.id,
    });

    isTypingRef.current = false;
  };

  const handleChange = (value: string) => {
    setMessage(value);

    if (!conversationId || !currentUser || !token) {
      return;
    }

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      socket.emit("typing", {
        conversationId,
        userId: currentUser.id,
        username: currentUser.username,
      });

      isTypingRef.current = true;
    }

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(stopTyping, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) return;

    onSend(trimmedMessage);
    setMessage("");
    stopTyping();
  };

  useEffect(() => {
    isTypingRef.current = false;

    return () => {
      stopTyping();
    };
  }, [conversationId, currentUser]);

  return (
    <form
      data-theme={theme}
      className="rtc-message-input"
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={stopTyping}
        placeholder="Message..."
        autoComplete="off"
      />

      <button
        type="submit"
        disabled={!message.trim()}
        aria-label="Send message"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path d="M22 2 11 13" />
          <path d="m22 2-7 20-4-9-9-4Z" />
        </svg>
      </button>
    </form>
  );
}