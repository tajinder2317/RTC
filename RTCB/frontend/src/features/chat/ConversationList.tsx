import { useEffect, useState } from "react";
import { useAuthStore } from "../auth/authStore";

type User = {
  id: string;
  username: string;
  email: string;
};

type Conversation = {
  id: string;
  createdAt: string;
  unreadCount: number;
  members: {
    user: User;
  }[];
  messages: {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
  }[];
};

type ConversationListProps = {
  onSelectConversation: (conversation: Conversation) => void;
};

export default function ConversationList({
  onSelectConversation,
}: ConversationListProps) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch("http://localhost:5000/conversations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch conversations");
        }

        setConversations(data.conversations);
      } catch (error) {
        console.error("Fetch conversations error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchConversations();
    }
  }, [token]);

  const getOtherUser = (conversation: Conversation) => {
    return conversation.members.find(
      (member) => member.user.id !== currentUser?.id,
    )?.user;
  };

  if (loading) {
    return <p>Loading conversations...</p>;
  }

  if (conversations.length === 0) {
    return <p>No conversations yet.</p>;
  }

  return (
    <div>
      {conversations.map((conversation) => {
        const otherUser = getOtherUser(conversation);
        const lastMessage = conversation.messages[0];

        if (!otherUser) {
          return null;
        }

        return (
          <div
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            style={{
              padding: "15px",
              borderBottom: "1px solid #ddd",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>{otherUser.username}</strong>

              {conversation.unreadCount > 0 && (
                <span
                  style={{
                    background: "#2563eb",
                    color: "white",
                    borderRadius: "999px",
                    minWidth: "22px",
                    height: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {conversation.unreadCount}
                </span>
              )}
            </div>

            <div
              style={{
                color: "#666",
                fontSize: "14px",
                marginTop: "5px",
              }}
            >
              {lastMessage ? lastMessage.text : "No messages yet"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
