import { useEffect, useState } from "react";
import { useAuthStore } from "../auth/authStore";
import MessageInput from "./MessageInput";
import ConversationList from "./ConversationList";
import { useChatStore } from "./chatStore";
import { socket, connectSocket } from "../../services/socket";
import TypingIndicator from "./TypingIndicator";

type User = {
  id: string;
  username: string;
  email: string;
};

type Conversation = {
  id: string;
  createdAt: string;
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

export default function ChatScreen() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messages = useChatStore((state) => state.messages);
  const typingUser = useChatStore((state) => state.typingUser);
  const setConversation = useChatStore((state) => state.setConversation);
  const setMessages = useChatStore((state) => state.setMessages);

  // Connect Socket.IO
  useEffect(() => {
    if (!token) return;

    connectSocket(token);

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Open an existing conversation
  const openConversation = async (conversation: Conversation) => {
    try {
      const otherUser = conversation.members.find(
        (member) => member.user.id !== currentUser?.id,
      )?.user;

      if (!otherUser) return;

      setSelectedUser(otherUser);
      setConversationId(conversation.id);

      // Join Socket.IO room
      setConversation(conversation.id);

      // Load messages
      const response = await fetch(
        `http://localhost:5000/messages/${conversation.id}`,
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

      setMessages(data.messages);
    } catch (error) {
      console.error("Open conversation error:", error);
    }
  };

  // Send message
  const sendMessage = (text: string) => {
    if (!conversationId || !currentUser) {
      return;
    }

    socket.emit("sendMessage", {
      conversationId,
      text,
      senderId: currentUser.id,
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
        {/* Conversation sidebar */}
        <div
          style={{
            width: "300px",
            background: "white",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #ddd",
            }}
          >
            <h2 style={{ margin: 0 }}>Conversations</h2>
          </div>

          <ConversationList onSelectConversation={openConversation} />
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
          {!selectedUser ? (
            <div style={{ padding: "30px" }}>
              <h2>Select a conversation</h2>
              <p>Choose a conversation from the left to start chatting.</p>
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
