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
  const setConversation = useChatStore((state) => state.setConversation);
  const setMessages = useChatStore((state) => state.setMessages);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  const [typingUser, setTypingUser] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("rtc-theme");

    return savedTheme === "light" ? "light" : "dark";
  });

  const onlineUserIds = usePresenceStore(
    (state) => state.onlineUserIds,
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const readReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const lastReadReceiptSignatureRef = useRef<string | null>(null);

  const unreadIncomingMessageIds = messages
    .filter(
      (message) =>
        message.conversationId === currentConversationId &&
        message.senderId !== currentUser?.id &&
        !message.readAt,
    )
    .map((message) => message.id);

  const unreadIncomingSignature =
    unreadIncomingMessageIds.length > 0 && currentConversationId
      ? `${currentConversationId}:${unreadIncomingMessageIds.join(",")}`
      : null;

  const startChatUsers = users.filter(
    (user) => user.username === "dhillon2317",
  );

  const selectedUser =
    currentConversation?.members.find(
      (member) => member.user.id !== currentUser?.id,
    )?.user ?? null;

  const isDark = theme === "dark";

  // ============================================================
  // THEME
  // ============================================================

  useEffect(() => {
    localStorage.setItem("rtc-theme", theme);
  }, [theme]);

  // ============================================================
  // LOAD USERS
  // ============================================================

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

  // ============================================================
  // FRIEND REQUEST COUNT
  // ============================================================

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
        console.error("Load friend requests count error:", error);
      }
    };

    void refreshFriendRequests();

    const unsubscribe = subscribeToFriendEvents({
      onNewRequest: () => {
        void refreshFriendRequests();
      },
      onAccepted: () => {
        void refreshFriendRequests();
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [token]);

  // ============================================================
  // LOAD MESSAGES
  // ============================================================

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
          throw new Error(data.message || "Failed to load messages");
        }

        if (cancelled) return;

        const existingMessages = useChatStore.getState().messages;

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

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [currentConversationId, setMessages, token]);

  // ============================================================
  // READ RECEIPTS
  // ============================================================

  useEffect(() => {
    if (readReceiptTimerRef.current) {
      clearTimeout(readReceiptTimerRef.current);
      readReceiptTimerRef.current = null;
    }

    if (!token || !currentConversationId || !currentUser) {
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

    lastReadReceiptSignatureRef.current = unreadIncomingSignature;

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

  // ============================================================
  // TYPING
  // ============================================================

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
      if (user.conversationId !== currentConversationId) return;
      if (user.userId === currentUser?.id) return;

      setTypingUser({
        userId: user.userId,
        username: user.username,
      });
    };

    const handleUserStoppedTyping = (user: {
      conversationId: string;
      userId: string;
    }) => {
      if (user.conversationId !== currentConversationId) return;
      if (user.userId === currentUser?.id) return;

      setTypingUser(null);
    };

    socket.on("userTyping", handleUserTyping);
    socket.on("userStoppedTyping", handleUserStoppedTyping);

    return () => {
      socket.off("userTyping", handleUserTyping);
      socket.off("userStoppedTyping", handleUserStoppedTyping);
      setTypingUser(null);
    };
  }, [currentConversationId, currentUser?.id]);

  // ============================================================
  // AUTO SCROLL
  // ============================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  // ============================================================
  // OPEN CONVERSATION
  // ============================================================

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

  // ============================================================
  // START CONVERSATION
  // ============================================================

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
          data.message || "Failed to create conversation",
        );
      }

      await openConversation(data.conversation);
    } catch (error) {
      console.error("Start conversation error:", error);
    } finally {
      setCreatingConversation(false);
    }
  };

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const sendMessage = (text: string) => {
    if (!currentConversationId || !currentUser) return;

    socket.emit("sendMessage", {
      conversationId: currentConversationId,
      text,
    });
  };

  const isSelectedUserOnline = selectedUser
    ? onlineUserIds.includes(selectedUser.id)
    : false;

  // ============================================================
  // UI
  // ============================================================

  return (
    <div
      data-theme={theme}
      className={
        isDark
          ? "rtc-chat-shell h-[100dvh] w-full overflow-hidden bg-[#050505] text-white"
          : "rtc-chat-shell h-[100dvh] w-full overflow-hidden bg-[#f5f5f7] text-[#111111]"
      }
    >
      {/* HEADER */}

      <header
        className={
          isDark
            ? "flex h-[68px] shrink-0 items-center justify-between border-b border-white/[0.07] bg-black/80 px-4 backdrop-blur-2xl md:px-7"
            : "flex h-[68px] shrink-0 items-center justify-between border-b border-black/[0.07] bg-white/80 px-4 backdrop-blur-2xl md:px-7"
        }
      >
        <div className="flex items-center gap-3">
          <div
            className={
              isDark
                ? "flex h-10 w-10 items-center justify-center rounded-[13px] border border-white/10 bg-white/[0.07] text-xs font-black text-white shadow-[0_8px_30px_rgba(0,0,0,.35)]"
                : "flex h-10 w-10 items-center justify-center rounded-[13px] border border-black/10 bg-white text-xs font-black text-black shadow-[0_8px_30px_rgba(0,0,0,.08)]"
            }
          >
            RT
          </div>

          <div>
            <h1
              className={
                isDark
                  ? "text-[15px] font-bold tracking-tight text-white"
                  : "text-[15px] font-bold tracking-tight text-black"
              }
            >
              Real-Time Chat
            </h1>

            <p
              className={
                isDark
                  ? "hidden text-[11px] text-white/40 sm:block"
                  : "hidden text-[11px] text-black/40 sm:block"
              }
            >
              Connected conversations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* THEME */}

          <button
            type="button"
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
            onClick={() =>
              setTheme((current) =>
                current === "dark" ? "light" : "dark",
              )
            }
            className={
              isDark
                ? "flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-white/70 backdrop-blur-xl transition hover:bg-white/[0.1] hover:text-white"
                : "flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-3 text-xs font-semibold text-black/65 backdrop-blur-xl transition hover:bg-white hover:text-black"
            }
          >
            <span className="text-base leading-none">
              {isDark ? "☀" : "☾"}
            </span>

            <span className="hidden sm:inline">
              {isDark ? "Light" : "Dark"}
            </span>
          </button>

          {/* FRIENDS */}

          <button
            type="button"
            onClick={() => navigate("/friends")}
            className={
              isDark
                ? "flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 text-xs font-semibold text-white/75 backdrop-blur-xl transition hover:bg-white/[0.1] hover:text-white"
                : "flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-3.5 text-xs font-semibold text-black/70 backdrop-blur-xl transition hover:bg-white hover:text-black"
            }
          >
            <span>Friends</span>

            {friendRequestCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[10px] font-bold text-white">
                {friendRequestCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* MAIN */}

      <main className="h-[calc(100dvh-68px)] overflow-hidden p-2 md:p-4 lg:p-5">
        <div
          className={
            isDark
              ? "mx-auto flex h-full max-w-[1500px] overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#090909] shadow-[0_30px_100px_rgba(0,0,0,.5)]"
              : "mx-auto flex h-full max-w-[1500px] overflow-hidden rounded-[22px] border border-black/[0.08] bg-white shadow-[0_30px_100px_rgba(0,0,0,.12)]"
          }
        >
          {/* SIDEBAR */}

          <aside
            className={
              isDark
                ? "flex h-full w-[285px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0a0a0a] lg:w-[330px]"
                : "flex h-full w-[285px] shrink-0 flex-col border-r border-black/[0.07] bg-[#fafafa] lg:w-[330px]"
            }
          >
            <div
              className={
                isDark
                  ? "flex h-[68px] shrink-0 items-center border-b border-white/[0.07] px-5"
                  : "flex h-[68px] shrink-0 items-center border-b border-black/[0.07] px-5"
              }
            >
              <div>
                <h2
                  className={
                    isDark
                      ? "text-sm font-bold text-white"
                      : "text-sm font-bold text-black"
                  }
                >
                  Conversations
                </h2>

                <p
                  className={
                    isDark
                      ? "mt-0.5 text-[11px] text-white/35"
                      : "mt-0.5 text-[11px] text-black/40"
                  }
                >
                  Your recent chats
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <ConversationList
                onSelectConversation={openConversation}
                currentConversationId={currentConversationId}
              />
            </div>

            <div
              className={
                isDark
                  ? "shrink-0 border-t border-white/[0.07] bg-black/40 p-4"
                  : "shrink-0 border-t border-black/[0.07] bg-white/70 p-4"
              }
            >
              <div className="mb-3 flex items-center justify-between">
                <h3
                  className={
                    isDark
                      ? "text-[10px] font-bold uppercase tracking-[0.14em] text-white/35"
                      : "text-[10px] font-bold uppercase tracking-[0.14em] text-black/40"
                  }
                >
                  Start a chat
                </h3>

                <span
                  className={
                    isDark
                      ? "rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/30"
                      : "rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[10px] text-black/35"
                  }
                >
                  Quick
                </span>
              </div>

              {loadingUsers ? (
                <div
                  className={
                    isDark
                      ? "flex items-center gap-2 text-xs text-white/35"
                      : "flex items-center gap-2 text-xs text-black/40"
                  }
                >
                  <span
                    className={
                      isDark
                        ? "h-3 w-3 animate-spin rounded-full border-2 border-white/10 border-t-white/60"
                        : "h-3 w-3 animate-spin rounded-full border-2 border-black/10 border-t-black/50"
                    }
                  />
                  Loading users...
                </div>
              ) : startChatUsers.length === 0 ? (
                <p
                  className={
                    isDark
                      ? "text-xs text-white/30"
                      : "text-xs text-black/35"
                  }
                >
                  No other users found.
                </p>
              ) : (
                <div className="space-y-2">
                  {startChatUsers.map((user) => {
                    const isOnline = onlineUserIds.includes(user.id);

                    return (
                      <div
                        key={user.id}
                        className={
                          isDark
                            ? "flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2.5 backdrop-blur-xl"
                            : "flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white/70 p-2.5 backdrop-blur-xl"
                        }
                      >
                        <div className="relative shrink-0">
                          <div
                            className={
                              isDark
                                ? "flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white/75"
                                : "flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] text-xs font-bold text-black/70"
                            }
                          >
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>

                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${
                              isDark
                                ? "border-[#0a0a0a]"
                                : "border-[#fafafa]"
                            } ${
                              isOnline
                                ? "bg-emerald-500"
                                : isDark
                                  ? "bg-white/20"
                                  : "bg-black/20"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={
                              isDark
                                ? "truncate text-xs font-semibold text-white/80"
                                : "truncate text-xs font-semibold text-black/75"
                            }
                          >
                            {user.username}
                          </p>

                          <p
                            className={
                              isDark
                                ? "truncate text-[10px] text-white/30"
                                : "truncate text-[10px] text-black/35"
                            }
                          >
                            {user.email}
                          </p>
                        </div>

                        <button
                          onClick={() => startConversation(user)}
                          disabled={creatingConversation}
                          className={
                            isDark
                              ? "rounded-lg border border-white/10 bg-white/[0.08] px-2.5 py-1.5 text-[10px] font-bold text-white/75 transition hover:bg-white/[0.14] hover:text-white disabled:opacity-40"
                              : "rounded-lg border border-black/10 bg-black/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-black/65 transition hover:bg-black/[0.09] hover:text-black disabled:opacity-40"
                          }
                        >
                          {creatingConversation ? "..." : "Chat"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* CHAT */}

          <section
            className={
              isDark
                ? "flex min-w-0 flex-1 flex-col bg-[#050505]"
                : "flex min-w-0 flex-1 flex-col bg-[#f8f8fa]"
            }
          >
            {!selectedUser || !currentConversationId ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-sm text-center">
                  <div
                    className={
                      isDark
                        ? "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/[0.08] bg-white/[0.04] text-2xl shadow-2xl"
                        : "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] border border-black/[0.08] bg-white text-2xl shadow-xl"
                    }
                  >
                    💬
                  </div>

                  <h2
                    className={
                      isDark
                        ? "text-lg font-bold text-white"
                        : "text-lg font-bold text-black"
                    }
                  >
                    Select a conversation
                  </h2>

                  <p
                    className={
                      isDark
                        ? "mt-2 text-sm leading-6 text-white/35"
                        : "mt-2 text-sm leading-6 text-black/45"
                    }
                  >
                    Choose a conversation from the sidebar to start
                    messaging in real time.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* CHAT HEADER */}

                <div
                  className={
                    isDark
                      ? "flex h-[68px] shrink-0 items-center border-b border-white/[0.07] bg-black/60 px-5 backdrop-blur-2xl md:px-6"
                      : "flex h-[68px] shrink-0 items-center border-b border-black/[0.07] bg-white/70 px-5 backdrop-blur-2xl md:px-6"
                  }
                >
                  <div className="relative mr-3 shrink-0">
                    <div
                      className={
                        isDark
                          ? "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-xs font-bold text-white"
                          : "flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-xs font-bold text-black"
                      }
                    >
                      {selectedUser.username.slice(0, 2).toUpperCase()}
                    </div>

                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${
                        isDark ? "border-black" : "border-white"
                      } ${
                        isSelectedUserOnline
                          ? "bg-emerald-500"
                          : isDark
                            ? "bg-white/20"
                            : "bg-black/20"
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <h2
                      className={
                        isDark
                          ? "truncate text-sm font-bold text-white"
                          : "truncate text-sm font-bold text-black"
                      }
                    >
                      {selectedUser.username}
                    </h2>

                    <div
                      className={`mt-0.5 flex items-center gap-1.5 text-[11px] font-medium ${
                        isSelectedUserOnline
                          ? "text-emerald-500"
                          : isDark
                            ? "text-white/30"
                            : "text-black/35"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelectedUserOnline
                            ? "bg-emerald-500"
                            : isDark
                              ? "bg-white/20"
                              : "bg-black/20"
                        }`}
                      />

                      {isSelectedUserOnline ? "Online" : "Offline"}
                    </div>
                  </div>
                </div>

                {/* MESSAGE AREA */}

                <div
                  className={
                    isDark
                      ? "rtc-messages min-h-0 flex-1 overflow-y-auto bg-[#050505] px-4 py-5 md:px-6"
                      : "rtc-messages min-h-0 flex-1 overflow-y-auto bg-[#f8f8fa] px-4 py-5 md:px-6"
                  }
                >
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <div className="mb-3 text-2xl">👋</div>

                        <p
                          className={
                            isDark
                              ? "text-sm font-medium text-white/50"
                              : "text-sm font-medium text-black/50"
                          }
                        >
                          No messages yet
                        </p>

                        <p
                          className={
                            isDark
                              ? "mt-1 text-xs text-white/25"
                              : "mt-1 text-xs text-black/30"
                          }
                        >
                          Say hello and start the conversation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-4xl flex-col gap-2.5">
                      {messages.map((message) => {
                        const isMine =
                          message.senderId === currentUser?.id;

                        const messageStatus = message.readAt
                          ? "✓✓"
                          : message.deliveredAt
                            ? "✓✓"
                            : "✓";

                        return (
                          <div
                            key={message.id}
                            className={`flex ${
                              isMine ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={
                                isMine
                                  ? "max-w-[78%] rounded-[20px] rounded-br-md border border-white/[0.12] bg-white/[0.10] px-4 py-2.5 text-white shadow-[0_8px_30px_rgba(0,0,0,.18)] backdrop-blur-2xl"
                                  : isDark
                                    ? "max-w-[78%] rounded-[20px] rounded-bl-md border border-white/[0.08] bg-white/[0.045] px-4 py-2.5 text-white/80 shadow-[0_8px_30px_rgba(0,0,0,.15)] backdrop-blur-2xl"
                                    : "max-w-[78%] rounded-[20px] rounded-bl-md border border-black/[0.08] bg-white/75 px-4 py-2.5 text-black/80 shadow-[0_8px_30px_rgba(0,0,0,.07)] backdrop-blur-2xl"
                              }
                            >
                              <p className="whitespace-pre-wrap break-words text-[13px] leading-5">
                                {message.text}
                              </p>

                              {isMine && (
                                <div className="mt-1 flex justify-end">
                                  <span
                                    className={
                                      message.readAt
                                        ? "text-[9px] font-semibold text-white/80"
                                        : "text-[9px] font-semibold text-white/40"
                                    }
                                  >
                                    {messageStatus}
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
                  typingUser.userId !== currentUser?.id && (
                    <div
                      className={
                        isDark
                          ? "shrink-0 border-t border-white/[0.05] bg-black/60 px-5 py-2 backdrop-blur-xl"
                          : "shrink-0 border-t border-black/[0.05] bg-white/70 px-5 py-2 backdrop-blur-xl"
                      }
                    >
                      <TypingIndicator username={typingUser.username} />
                    </div>
                  )}

                {/* COMPOSER */}

                <div
                  className={
                    isDark
                      ? "shrink-0 border-t border-white/[0.07] bg-black/75 p-3 backdrop-blur-2xl md:p-4"
                      : "shrink-0 border-t border-black/[0.07] bg-white/75 p-3 backdrop-blur-2xl md:p-4"
                  }
                >
                  <div className="mx-auto max-w-4xl">
                    <MessageInput onSend={sendMessage} theme={theme} />
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