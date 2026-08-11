import { useState } from "react";

type MessageInputProps = {
  onSend: (message: string) => void;
};

export default function MessageInput({ onSend }: MessageInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    onSend(trimmedMessage);
    setMessage("");
  };

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
        onChange={(e) => setMessage(e.target.value)}
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
