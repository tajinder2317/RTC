import type { Friend } from "../../services/api";
import { usePresenceStore } from "../presence/presenceStore";

type FriendListProps = {
  friends: Friend[];
  onMessage: (friend: Friend) => void;
  onRemove: (friend: Friend) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
};

export default function FriendList({
  friends,
  onMessage,
  onRemove,
  loading = false,
  emptyTitle = "No friends yet.",
  emptySubtitle,
}: FriendListProps) {
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);

  if (loading) {
    return <p style={{ color: "#666" }}>Loading friends...</p>;
  }

  if (friends.length === 0) {
    return (
      <div style={{ color: "#666", lineHeight: 1.6 }}>
        <p style={{ marginTop: 0, marginBottom: 4 }}>{emptyTitle}</p>
        {emptySubtitle && <p style={{ margin: 0 }}>{emptySubtitle}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {friends.map((friend) => (
        <div
          key={friend.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            background: "white",
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>{friend.username}</div>
            <div
              style={{
                fontSize: "12px",
                color: onlineUserIds.includes(friend.id) ? "#16a34a" : "#6b7280",
                marginTop: "3px",
              }}
            >
              {onlineUserIds.includes(friend.id) ? "🟢 Online" : "⚫ Offline"}
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
              {friend.email}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => onMessage(friend)}
              style={{
                border: "none",
                borderRadius: "8px",
                background: "#2563eb",
                color: "white",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Message
            </button>

            <button
              type="button"
              onClick={() => onRemove(friend)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                background: "white",
                color: "#111827",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Remove Friend
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
