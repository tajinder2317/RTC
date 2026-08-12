import { useEffect, useState } from "react";
import { useAuthStore } from "../auth/authStore";
import { socket } from "../../services/socket";
import { getUsers, createConversation } from "../../services/api";
import type { Conversation, ChatUser } from "./chatStore";
import { usePresenceStore } from "../presence/presenceStore";

type ConversationListProps = {
  onSelectConversation: (conversation: Conversation) => void;
  currentConversationId: string | null;
};

export default function ConversationList({
  onSelectConversation,
  currentConversationId,
}: ConversationListProps) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  // =========================
  // FETCH CONVERSATIONS
  // =========================

  useEffect(() => {
    const fetchConversations = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/conversations`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

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

    fetchConversations();
  }, [token]);

  // =========================
  // FETCH USERS
  // =========================

  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) {
        setUsersLoading(false);
        return;
      }

      try {
        setUsersLoading(true);

        const data = await getUsers(token);

        setUsers(data);
      } catch (error) {
        console.error("Fetch users error:", error);
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (!currentConversationId) {
      return;
    }

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === currentConversationId
          ? {
              ...conversation,
              unreadCount: 0,
            }
          : conversation,
      ),
    );
  }, [currentConversationId]);

  // =========================
  // REAL-TIME MESSAGE UPDATES
  // =========================

  useEffect(() => {
    const handleNewMessage = (message: {
      id: string;
      conversationId: string;
      senderId: string;
      text: string;
      createdAt: string;
    }) => {
      setConversations((prev) => {
      const conversation = prev.find(
            (item) => item.id === message.conversationId,
          );

        if (!conversation) {
          return prev;
        }

        const isCurrentConversation = conversation.id === currentConversationId;
        const isMine = message.senderId === currentUser?.id;
        const nextUnreadCount =
          isCurrentConversation || isMine
            ? 0
            : (conversation.unreadCount ?? 0) + 1;

        const nextMessages = [
          {
            id: message.id,
            conversationId: message.conversationId,
            text: message.text,
            senderId: message.senderId,
            createdAt: message.createdAt,
          },
          ...conversation.messages.filter((item) => item.id !== message.id),
        ];

        const updatedConversation: Conversation = {
          ...conversation,
          unreadCount: nextUnreadCount,
          messages: nextMessages,
        };

        return [
          updatedConversation,
          ...prev.filter((item) => item.id !== message.conversationId),
        ];
      });
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [currentUser?.id, currentConversationId]);

  useEffect(() => {
    const handleMessageRead = (payload: {
      conversationId: string;
      messageIds: string[];
      readAt: string;
    }) => {
      if (!payload.conversationId || payload.messageIds.length === 0) {
        return;
      }

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== payload.conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            unreadCount: 0,
            messages: conversation.messages.map((message) =>
              payload.messageIds.includes(message.id)
                ? {
                    ...message,
                    readAt: payload.readAt,
                  }
                : message,
            ),
          };
        }),
      );
    };

    socket.on("message:read", handleMessageRead);

    return () => {
      socket.off("message:read", handleMessageRead);
    };
  }, []);

  // =========================
  // GET OTHER USER
  // =========================

  const getOtherUser = (conversation: Conversation) => {
    return conversation.members.find(
      (member) => member.user.id !== currentUser?.id,
    )?.user;
  };

  // =========================
  // OPEN EXISTING CONVERSATION
  // =========================

  const handleSelectConversation = (conversation: Conversation) => {
    setConversations((prev) =>
      prev.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              unreadCount: 0,
            }
          : item,
      ),
    );

    onSelectConversation(conversation);
  };

  // =========================
  // START NEW CHAT
  // =========================

  const handleStartChat = async (user: ChatUser) => {
    if (!token) return;

    try {
      setStartingChat(user.id);

      const conversation = await createConversation(token, user.id);

      // Check if it already exists in the sidebar
      setConversations((prev) => {
        const exists = prev.some((item) => item.id === conversation.id);

        if (exists) {
          return prev.map((item) =>
            item.id === conversation.id
              ? {
                  ...item,
                  unreadCount: 0,
                }
              : item,
          );
        }

        return [
          {
            ...conversation,
            unreadCount: 0,
            messages: conversation.messages || [],
          },
          ...prev,
        ];
      });

      // Open the chat immediately
      onSelectConversation({
        ...conversation,
        unreadCount: 0,
        messages: conversation.messages || [],
      });

      // Clear search
      setSearch("");
    } catch (error) {
      console.error("Start chat error:", error);
    } finally {
      setStartingChat(null);
    }
  };

  // =========================
  // SEARCH
  // =========================

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return <p style={{ padding: "15px" }}>Loading conversations...</p>;
  }

  return (
    <div>
      {/* ========================= */}
      {/* SEARCH USERS */}
      {/* ========================= */}

      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid #ddd",
        }}
      >
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            outline: "none",
            fontSize: "14px",
          }}
        />

        {/* Search results */}

        {search.trim() && (
          <div
            style={{
              marginTop: "8px",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            {usersLoading ? (
              <p
                style={{
                  fontSize: "14px",
                  color: "#666",
                }}
              >
                Loading users...
              </p>
            ) : filteredUsers.length === 0 ? (
              <p
                style={{
                  fontSize: "14px",
                  color: "#666",
                }}
              >
                No users found
              </p>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 5px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "14px",
                      }}
                    >
                      {user.username}
                    </strong>

                    <span
                      style={{
                        fontSize: "12px",
                        color: "#777",
                      }}
                    >
                      {user.email}
                    </span>
                  </div>

                  <button
                    onClick={() => handleStartChat(user)}
                    disabled={startingChat === user.id}
                    style={{
                      border: "none",
                      background: "#2563eb",
                      color: "white",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    {startingChat === user.id ? "..." : "Chat"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* CONVERSATIONS */}
      {/* ========================= */}

      {conversations.length === 0 ? (
        <p
          style={{
            padding: "15px",
            color: "#666",
          }}
        >
          No conversations yet.
        </p>
      ) : (
        <div>
          {conversations.map((conversation) => {
            const otherUser = getOtherUser(conversation);
            const lastMessage = conversation.messages[0];
            const isOnline = otherUser ? onlineUserIds.includes(otherUser.id) : false;

            if (!otherUser) {
              return null;
            }

            const isSelected = conversation.id === currentConversationId;

            return (
              <div
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                style={{
                  padding: "15px",
                  borderBottom: "1px solid #ddd",
                  cursor: "pointer",
                  background: isSelected ? "#eff6ff" : "white",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{otherUser.username}</strong>

                    <div
                      style={{
                        fontSize: "12px",
                        color: isOnline ? "#16a34a" : "#6b7280",
                        marginTop: "3px",
                      }}
                    >
                      {isOnline ? "🟢 Online" : "⚫ Offline"}
                    </div>
                  </div>

                  {(conversation.unreadCount ?? 0) > 0 && (
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
                      {conversation.unreadCount ?? 0}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    color: "#666",
                    fontSize: "14px",
                    marginTop: "5px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {lastMessage ? lastMessage.text : "No messages yet"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
