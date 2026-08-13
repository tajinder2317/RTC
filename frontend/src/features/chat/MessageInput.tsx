import {
  useEffect,
  useRef,
  useState,
} from "react";
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

  const typingTimeout = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const isTypingRef = useRef(false);

  const isDark = theme === "dark";

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

    if (
      !conversationId ||
      !currentUser ||
      !token
    ) {
      return;
    }

    const hasText =
      value.trim().length > 0;

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

  const handleSubmit = (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    const trimmedMessage =
      message.trim();

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
      className={
        isDark
          ? "flex w-full items-center gap-2 rounded-[18px] border border-white/[0.10] bg-white/[0.055] p-1.5 shadow-[0_10px_40px_rgba(0,0,0,.35)] backdrop-blur-2xl transition"
          : "flex w-full items-center gap-2 rounded-[18px] border border-black/[0.08] bg-white/80 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,.08)] backdrop-blur-2xl transition"
      }
    >
      <input
        type="text"
        value={message}
        onChange={(e) =>
          handleChange(e.target.value)
        }
        onBlur={stopTyping}
        placeholder="Message..."
        autoComplete="off"
        className={
          isDark
            ? "h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-0 focus:outline-none focus:ring-0"
            : "h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] text-black outline-none placeholder:text-black/35 focus:border-0 focus:outline-none focus:ring-0"
        }
      />

      <button
        type="submit"
        disabled={!message.trim()}
        aria-label="Send message"
        className={
          isDark
            ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white text-black shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/25"
            : "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-black/10 bg-black text-white shadow-sm transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/[0.06] disabled:text-black/25"
        }
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