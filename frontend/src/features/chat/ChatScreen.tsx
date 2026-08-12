import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../auth/authStore";
import MessageInput from "./MessageInput";
import ConversationList from "./ConversationList";
import { useChatStore } from "./chatStore";
import { socket, connectSocket, disconnectSocket } from "../../services/socket";
import TypingIndicator from "./TypingIndicator";

type User = {
  id: string;
  username: string;
  email: string;
};

export default function ChatScreen() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const currentConversation = useChatStore((state) => state.currentConversation);
  const currentConversationId = useChatStore(
    (state) => state.currentConversationId,
  );
  const messages = useChatStore((state) => state.messages);
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const typingUser = useChatStore((state) => state.typingUser);
  const setConversation = useChatStore((state) => state.setConversation);
  const setMessages = useChatStore((state) => state.setMessages);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selectedUser =
    currentConversation?.members.find(
      (member) => member.user.id !== currentUser?.id,
    )?.user ?? null;

  // Connect Socket.IO
  useEffect(() => {
    if (!token) return;

    connectSocket(token);

    return () => {
      disconnectSocket();
    };
  }, [token]);

  // Load users for the quick chat list on the right
  useEffect(() => {
    if (!token) return;

    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);

        const response = await fetch(`${import.meta.env.VITE_API_URL}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch users");
        }

        setUsers(data.users);
      } catch (error) {
        console.error("Fetch users error:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [token]);

  // Load conversation messages whenever the active conversation changes
  useEffect(() => {
    if (!token || !currentConversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/conversations/${currentConversationId}/messages`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load messages");
        }

        if (cancelled) {
          return;
        }

        const existingMessages = useChatStore.getState().messages;
        const mergedMessages = [
          ...data.messages,
          ...existingMessages.filter(
            (existingMessage) =>
              !data.messages.some((message: { id: string }) => message.id === existingMessage.id),
          ),
        ].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        setMessages(mergedMessages);

        await fetch(
          `${import.meta.env.VITE_API_URL}/conversations/${currentConversationId}/read`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      } catch (error) {
        console.error("Load messages error:", error);
      }
    };

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [currentConversationId, setMessages, token]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // Open an existing conversation
  const openConversation = async (conversation: {
    id: string;
    createdAt: string;
    unreadCount?: number;
    members: {
      user: User;
    }[];
    messages: {
      id: string;
      conversationId: string;
      senderId: string;
      text: string;
      createdAt: string;
      deliveredAt?: string | null;
      readAt?: string | null;
    }[];
  }) => {
    setConversation(conversation);
  };

  // Create or get conversation with a user
  const startConversation = async (user: User) => {
    if (!token || creatingConversation) return;

    try {
      setCreatingConversation(true);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user.id,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create conversation");
      }

      await openConversation(data.conversation);
    } catch (error) {
      console.error("Start conversation error:", error);
    } finally {
      setCreatingConversation(false);
    }
  };

  // Send message
  const sendMessage = (text: string) => {
    if (!currentConversationId || !currentUser) {
      return;
    }

    socket.emit("sendMessage", {
      conversationId: currentConversationId,
      text,
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#111",
        padding: "40px",
      }}
    >
      <h1>Real-Time Chat</h1>

      <div
        style={{
          display: "flex",
          gap: "20px",
          marginTop: "30px",
          minHeight: "500px",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: "300px",
            background: "white",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          {/* Conversations */}
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #ddd",
            }}
          >
            <h2 style={{ margin: 0 }}>Conversations</h2>
          </div>

          <div style={{ padding: "10px 20px" }}>
            <ConversationList
              onSelectConversation={openConversation}
              currentConversationId={currentConversationId}
            />
          </div>

          {/* Users */}
          <div
            style={{
              borderTop: "1px solid #ddd",
              padding: "20px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Start a new chat</h3>

            {loadingUsers ? (
              <p>Loading users...</p>
            ) : users.length === 0 ? (
              <p>No other users found.</p>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <div>
                    <strong>{user.username}</strong>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#777",
                      }}
                    >
                      {user.email}
                    </div>
                  </div>

                  <button
                    onClick={() => startConversation(user)}
                    disabled={creatingConversation}
                    style={{
                      border: "none",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      cursor: creatingConversation ? "not-allowed" : "pointer",
                    }}
                  >
                    Chat
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div
          style={{
            flex: 1,
            background: "white",
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            minHeight: "500px",
          }}
        >
          {!selectedUser || !currentConversationId ? (
            <div style={{ padding: "30px" }}>
              <h2>Select a conversation</h2>
              <p>
                Choose an existing conversation or start a new chat from the
                left.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                <h2 style={{ margin: 0 }}>{selectedUser.username}</h2>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "14px",
                    color: onlineUsers.includes(selectedUser.id)
                      ? "green"
                      : "#777",
                  }}
                >
                  {onlineUsers.includes(selectedUser.id)
                    ? "🟢 Online"
                    : "⚫ Offline"}
                </div>
              </div>

              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  padding: "20px",
                  overflowY: "auto",
                }}
              >
                {messages.length === 0 ? (
                  <p>No messages yet. Say hello!</p>
                ) : (
                  messages.map((message) => {
                    const isMine = message.senderId === currentUser?.id;

                    return (
                      <div
                        key={message.id}
                        style={{
                          display: "flex",
                          justifyContent: isMine ? "flex-end" : "flex-start",
                          marginBottom: "10px",
                        }}
                      >
                        <div
                          style={{
                            padding: "10px 14px",
                            background: isMine ? "#dbeafe" : "#f1f1f1",
                            borderRadius: "8px",
                            maxWidth: "70%",
                          }}
                        >
                          {message.text}
                        </div>
                      </div>
                    );
                  })
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Typing indicator */}
              {typingUser && typingUser.userId !== currentUser?.id && (
                <TypingIndicator username={typingUser.username} />
              )}

              {/* Message input */}
              <MessageInput onSend={sendMessage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
