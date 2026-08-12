import type { FriendRequest } from "../../services/api";

type FriendRequestsProps = {
  requests: FriendRequest[];
  onAccept: (request: FriendRequest) => void;
  onReject: (request: FriendRequest) => void;
  loading?: boolean;
  emptyMessage?: string;
};

export default function FriendRequests({
  requests,
  onAccept,
  onReject,
  loading = false,
  emptyMessage = "No pending friend requests.",
}: FriendRequestsProps) {
  if (loading) {
    return <p style={{ color: "#666" }}>Loading requests...</p>;
  }

  if (requests.length === 0) {
    return <p style={{ color: "#666" }}>{emptyMessage}</p>;
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {requests.map((request) => (
        <div
          key={request.id}
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
            <div style={{ fontWeight: 700 }}>{request.sender.username}</div>
            <div style={{ fontSize: "13px", color: "#6b7280" }}>
              {request.sender.email}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => onAccept(request)}
              style={{
                border: "none",
                borderRadius: "8px",
                background: "#16a34a",
                color: "white",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Accept
            </button>

            <button
              type="button"
              onClick={() => onReject(request)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                background: "white",
                color: "#111827",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
