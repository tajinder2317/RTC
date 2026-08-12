type TypingIndicatorProps = {
  username: string;
};

export default function TypingIndicator({ username }: TypingIndicatorProps) {
  return (
    <div
      style={{
        padding: "5px 20px 10px",
        color: "#666",
        fontSize: "14px",
      }}
    >
      <span>{username} is typing</span>
      <span style={{ marginLeft: "4px" }}>●</span>
      <span>●</span>
      <span>●</span>
    </div>
  );
}
