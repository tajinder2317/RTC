import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import MessageInput from "./MessageInput";
import ConversationList from "./ConversationList";
import { useChatStore } from "./chatStore";
import { socket } from "../../services/socket";
import TypingIndicator from "./TypingIndicator";
import { getFriendRequests } from "../../services/api";
import { subscribeToFriendEvents } from "../friends/friendsRealtime";
import { usePresenceStore } from "../presence/presenceStore";

type User = {
  id: string;
  username: string;
  email: string;
};

type Theme = "dark" | "light";

export default function ChatScreen() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const navigate = useNavigate();

  const currentConversation = useChatStore(
    (state) => state.currentConversation,
  );

  const currentConversationId = useChatStore(
    (state) => state.currentConversationId,
  );

  const messages = useChatStore((state) => state.messages);

  const setConversation = useChatStore(
    (state) => state.setConversation,
  );

  const setMessages = useChatStore(
    (state) => state.setMessages,
  );

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creatingConversation, setCreatingConversation] =
    useState(false);

  const [friendRequestCount, setFriendRequestCount] =
    useState(0);

  const [typingUser, setTypingUser] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  const [theme, setTheme] = useState<Theme>(() => {
    return localStorage.getItem("rtc-theme") === "light"
      ? "light"
      : "dark";
  });

  /*
   * =========================================================
   * MOBILE NAVIGATION
   * =========================================================
   */

  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const onlineUserIds = usePresenceStore(
    (state) => state.onlineUserIds,
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const readReceiptTimerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const lastReadReceiptSignatureRef =
    useRef<string | null>(null);

  /*
   * =========================================================
   * DERIVED DATA
   * =========================================================
   */

  const unreadIncomingMessageIds = messages
    .filter(
      (message) =>
        message.conversationId === currentConversationId &&
        message.senderId !== currentUser?.id &&
        !message.readAt,
    )
    .map((message) => message.id);

  const unreadIncomingSignature =
    unreadIncomingMessageIds.length > 0 &&
    currentConversationId
      ? `${currentConversationId}:${unreadIncomingMessageIds.join(",")}`
      : null;

  /*
   * Keep your temporary restriction:
   * only show dhillon2317 in Quick Chat.
   */
  const startChatUsers = users.filter(
    (user) =>
      user.username === "dhillon2317" &&
      user.id !== currentUser?.id,
  );

  const selectedUser =
    currentConversation?.members.find(
      (member) => member.user.id !== currentUser?.id,
    )?.user ?? null;

  const isSelectedUserOnline = selectedUser
    ? onlineUserIds.includes(selectedUser.id)
    : false;

  const latestOutgoingMessageId =
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.senderId === currentUser?.id,
      )?.id ?? null;

  const isDark = theme === "dark";

  /*
   * =========================================================
   * THEME
   * =========================================================
   */

  useEffect(() => {
    localStorage.setItem("rtc-theme", theme);
  }, [theme]);

  /*
   * =========================================================
   * LOAD USERS
   * =========================================================
   */

  useEffect(() => {
    if (!token) return;

    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/users`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to fetch users",
          );
        }

        setUsers(data.users);
      } catch (error) {
        console.error("Fetch users error:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    void fetchUsers();
  }, [token]);

  /*
   * =========================================================
   * FRIEND REQUEST COUNT
   * =========================================================
   */

  useEffect(() => {
    if (!token) {
      setFriendRequestCount(0);
      return;
    }

    let cancelled = false;

    const refreshFriendRequests = async () => {
      try {
        const requests = await getFriendRequests(token);

        if (!cancelled) {
          setFriendRequestCount(requests.length);
        }
      } catch (error) {
        console.error(
          "Load friend requests count error:",
          error,
        );
      }
    };

    void refreshFriendRequests();

    const unsubscribe = subscribeToFriendEvents({
      onNewRequest: () => void refreshFriendRequests(),
      onAccepted: () => void refreshFriendRequests(),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [token]);

  /*
   * =========================================================
   * LOAD MESSAGES
   * =========================================================
   */

  useEffect(() => {
    if (!token || !currentConversationId) {
      setTypingUser(null);
      setMessages([]);
      return;
    }

    let cancelled = false;

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/messages/${currentConversationId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load messages",
          );
        }

        if (cancelled) return;

        const existingMessages =
          useChatStore.getState().messages;

        const mergedMessages = [
          ...data.messages,
          ...existingMessages.filter(
            (existingMessage) =>
              !data.messages.some(
                (message: { id: string }) =>
                  message.id === existingMessage.id,
              ),
          ),
        ].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );

        setMessages(mergedMessages);
      } catch (error) {
        console.error("Load messages error:", error);
      }
    };

    void fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [currentConversationId, setMessages, token]);

  /*
   * =========================================================
   * READ RECEIPTS
   * =========================================================
   */

  useEffect(() => {
    if (readReceiptTimerRef.current) {
      clearTimeout(readReceiptTimerRef.current);
      readReceiptTimerRef.current = null;
    }

    if (
      !token ||
      !currentConversationId ||
      !currentUser
    ) {
      lastReadReceiptSignatureRef.current = null;
      return;
    }

    if (!unreadIncomingSignature) {
      lastReadReceiptSignatureRef.current = null;
      return;
    }

    if (
      lastReadReceiptSignatureRef.current ===
      unreadIncomingSignature
    ) {
      return;
    }

    lastReadReceiptSignatureRef.current =
      unreadIncomingSignature;

    readReceiptTimerRef.current = setTimeout(() => {
      socket.emit("conversation:read", {
        conversationId: currentConversationId,
      });
    }, 100);

    return () => {
      if (readReceiptTimerRef.current) {
        clearTimeout(readReceiptTimerRef.current);
        readReceiptTimerRef.current = null;
      }
    };
  }, [
    currentConversationId,
    currentUser?.id,
    token,
    unreadIncomingSignature,
  ]);

  /*
   * =========================================================
   * TYPING INDICATOR
   * =========================================================
   */

  useEffect(() => {
    if (!currentConversationId) {
      setTypingUser(null);
      return;
    }

    const handleUserTyping = (user: {
      conversationId: string;
      userId: string;
      username: string;
    }) => {
      if (
        user.conversationId !== currentConversationId ||
        user.userId === currentUser?.id
      ) {
        return;
      }

      setTypingUser({
        userId: user.userId,
        username: user.username,
      });
    };

    const handleUserStoppedTyping = (user: {
      conversationId: string;
      userId: string;
    }) => {
      if (
        user.conversationId !== currentConversationId ||
        user.userId === currentUser?.id
      ) {
        return;
      }

      setTypingUser(null);
    };

    socket.on("userTyping", handleUserTyping);
    socket.on(
      "userStoppedTyping",
      handleUserStoppedTyping,
    );

    return () => {
      socket.off("userTyping", handleUserTyping);
      socket.off(
        "userStoppedTyping",
        handleUserStoppedTyping,
      );

      setTypingUser(null);
    };
  }, [currentConversationId, currentUser?.id]);

  /*
   * =========================================================
   * AUTO SCROLL
   * =========================================================
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  /*
   * =========================================================
   * OPEN CONVERSATION
   * =========================================================
   */

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

    /*
     * This is the important mobile fix.
     *
     * ConversationList opens the chat panel instead
     * of leaving it off-screen.
     */
    setMobileChatOpen(true);
  };

  /*
   * =========================================================
   * MOBILE BACK
   * =========================================================
   */

  const closeMobileChat = () => {
    setMobileChatOpen(false);
  };

  /*
   * =========================================================
   * START CONVERSATION
   * =========================================================
   */

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
        throw new Error(
          data.message ||
            "Failed to create conversation",
        );
      }

      await openConversation(data.conversation);
    } catch (error) {
      console.error(
        "Start conversation error:",
        error,
      );
    } finally {
      setCreatingConversation(false);
    }
  };

  /*
   * =========================================================
   * SEND MESSAGE
   * =========================================================
   */

  const sendMessage = (text: string) => {
    if (!currentConversationId || !currentUser) {
      return;
    }

    socket.emit("sendMessage", {
      conversationId: currentConversationId,
      text,
    });
  };

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div
      data-theme={theme}
      className={`rtc-chat-shell ${
        isDark
          ? "rtc-theme-dark"
          : "rtc-theme-light"
      }`}
    >
      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="rtc-header">
        <div className="flex items-center gap-3">
          <div className="rtc-brand-mark">
            RT
          </div>

          <div>
            <h1 className="rtc-header-title">
              Real-Time Chat
            </h1>

            <p className="rtc-header-subtitle">
              Connected conversations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Switch to ${
              isDark ? "light" : "dark"
            } mode`}
            title={`Switch to ${
              isDark ? "light" : "dark"
            } mode`}
            onClick={() =>
              setTheme((current) =>
                current === "dark"
                  ? "light"
                  : "dark",
              )
            }
            className="rtc-header-button"
          >
            <span className="text-base leading-none">
              {isDark ? "☀" : "☾"}
            </span>

            <span className="hidden sm:inline">
              {isDark ? "Light" : "Dark"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/friends")}
            className="rtc-header-button"
          >
            <span>Friends</span>

            {friendRequestCount > 0 && (
              <span className="rtc-count-badge">
                {friendRequestCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="rtc-main">
        <div className="rtc-chat-frame">
          {/* =================================================
              SIDEBAR
              ================================================= */}

          <aside
            className={`rtc-sidebar ${
              mobileChatOpen
                ? "is-mobile-hidden"
                : ""
            }`}
          >
            <div className="rtc-sidebar-header">
              <div>
                <h2 className="rtc-section-title">
                  Conversations
                </h2>

                <p className="rtc-section-subtitle">
                  Your recent chats
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <ConversationList
                onSelectConversation={
                  openConversation
                }
                currentConversationId={
                  currentConversationId
                }
              />
            </div>

            {/* QUICK CHAT */}

            <div className="rtc-quick-chat">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="rtc-eyebrow">
                  Start a chat
                </h3>

                <span className="rtc-quick-label">
                  Quick
                </span>
              </div>

              {loadingUsers ? (
                <div className="rtc-muted-row">
                  <span className="rtc-spinner" />
                  Loading users...
                </div>
              ) : startChatUsers.length === 0 ? (
                <p className="rtc-muted-text">
                  No other users found.
                </p>
              ) : (
                <div className="space-y-2">
                  {startChatUsers.map((user) => {
                    const isOnline =
                      onlineUserIds.includes(
                        user.id,
                      );

                    return (
                      <div
                        key={user.id}
                        className="rtc-quick-user"
                      >
                        <div className="relative shrink-0">
                          <div className="rtc-avatar rtc-avatar-small">
                            {user.username
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <span
                            className={`rtc-status-dot ${
                              isOnline
                                ? "is-online"
                                : ""
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="rtc-user-name">
                            {user.username}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            startConversation(
                              user,
                            )
                          }
                          disabled={
                            creatingConversation
                          }
                          className="rtc-small-button"
                        >
                          {creatingConversation
                            ? "..."
                            : "Chat"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* =================================================
              CHAT PANEL
              ================================================= */}

          <section
            className={`rtc-chat-panel ${
              mobileChatOpen
                ? "is-mobile-visible"
                : "is-mobile-hidden"
            }`}
          >
            {!selectedUser ||
            !currentConversationId ? (
              <div className="rtc-empty-state">
                <div>
                  <div className="rtc-empty-icon">
                    💬
                  </div>

                  <h2 className="rtc-empty-title">
                    Select a conversation
                  </h2>

                  <p className="rtc-empty-description">
                    Choose a conversation from
                    the sidebar to start messaging
                    in real time.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* CHAT HEADER */}

                <div className="rtc-chat-header">
                  {/* MOBILE BACK BUTTON */}

                  <button
                    type="button"
                    className="rtc-mobile-back"
                    onClick={
                      closeMobileChat
                    }
                    aria-label="Back to conversations"
                  >
                    ‹
                  </button>

                  <div className="relative mr-3 shrink-0">
                    <div className="rtc-avatar">
                      {selectedUser.username
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <span
                      className={`rtc-status-dot ${
                        isSelectedUserOnline
                          ? "is-online"
                          : ""
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <h2 className="rtc-chat-user">
                      {selectedUser.username}
                    </h2>

                    <div
                      className={`rtc-presence ${
                        isSelectedUserOnline
                          ? "is-online"
                          : ""
                      }`}
                    >
                      <span className="rtc-presence-dot" />

                      {isSelectedUserOnline
                        ? "Online"
                        : "Offline"}
                    </div>
                  </div>
                </div>

                {/* MESSAGE AREA */}

                <div className="rtc-messages rtc-scrollbar">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <div className="mb-3 text-2xl">
                          👋
                        </div>

                        <p className="rtc-empty-message-title">
                          No messages yet
                        </p>

                        <p className="rtc-empty-message-description">
                          Say hello and start the
                          conversation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-4xl flex-col gap-2.5">
                      {messages.map((message) => {
                        const isMine =
                          message.senderId ===
                          currentUser?.id;

                        const isLatestOutgoingMessage =
                          isMine &&
                          message.id ===
                            latestOutgoingMessageId;

                        const messageStatus =
                          message.readAt
                            ? "✓✓"
                            : message.deliveredAt
                              ? "✓✓"
                              : "✓";

                        return (
                          <div
                            key={message.id}
                            className={`flex ${
                              isMine
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`rtc-message ${
                                isMine
                                  ? "is-mine"
                                  : "is-theirs"
                              }`}
                            >
                              <p>
                                {message.text}
                              </p>

                              {isLatestOutgoingMessage && (
                                <div className="rtc-message-status">
                                  <span
                                    className={
                                      message.readAt
                                        ? "is-read"
                                        : ""
                                    }
                                  >
                                    {
                                      messageStatus
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* TYPING */}

                {typingUser &&
                  typingUser.userId !==
                    currentUser?.id && (
                    <div className="rtc-typing-bar">
                      <TypingIndicator
                        username={
                          typingUser.username
                        }
                      />
                    </div>
                  )}

                {/* COMPOSER */}

                <div className="rtc-composer">
                  <div className="mx-auto max-w-4xl">
                    <MessageInput
                      onSend={sendMessage}
                      theme={theme}
                    />
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}