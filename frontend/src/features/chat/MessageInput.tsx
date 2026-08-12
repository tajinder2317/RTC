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

  const handleChange = (value: string) => {
    setMessage(value);

    if (!conversationId || !currentUser || !token) {
      return;
    }

    socket.emit("typing", {
      conversationId,
      userId: currentUser.id,
      username: currentUser.username,
    });

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      socket.emit("stopTyping", {
        conversationId,
        userId: currentUser.id,
      });
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    onSend(trimmedMessage);
    setMessage("");

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    if (conversationId && currentUser) {
      socket.emit("stopTyping", {
        conversationId,
        userId: currentUser.id,
      });
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }

      if (conversationId && currentUser) {
        socket.emit("stopTyping", {
          conversationId,
          userId: currentUser.id,
        });
      }
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
