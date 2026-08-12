import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../auth/authStore";
import { useChatStore } from "./chatStore";
import { socket } from "../../services/socket";

type MessageInputProps = {
  onSend: (message: string) => void;
};

export default function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState("");

  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const conversationId = useChatStore((state) => state.currentConversationId);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const stopTyping = () => {
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }

    if (!conversationId || !currentUser || !isTypingRef.current) {
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

    const hasText = value.trim().length > 0;

    if (!hasText) {
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

    typingTimeout.current = setTimeout(() => {
      stopTyping();
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

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
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: "10px",
        padding: "10px",
        borderTop: "1px solid #ddd",
        background: "white",
      }}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={stopTyping}
        placeholder="Type a message..."
        style={{
          flex: 1,
          padding: "10px",
          border: "1px solid #ccc",
          borderRadius: "6px",
        }}
      />

      <button
        type="submit"
        style={{
          padding: "10px 16px",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </form>
  );
}
