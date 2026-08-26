import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import MessageInput from "./MessageInput";
import ConversationList from "./ConversationList";
import ChatMessages from "./ChatMessages";
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

  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);

  const [friendRequestCount, setFriendRequestCount] = useState(0);

  const [typingUser, setTypingUser] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return localStorage.getItem("rtc-theme") === "light" ? "light" : "dark";
  });

  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const readReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const lastReadReceiptSignatureRef = useRef<string | null>(null);

  /* =========================================================
     THEME
     ========================================================= */

  useEffect(() => {
    localStorage.setItem("rtc-theme", theme);
  }, [theme]);

  const isDark = theme === "dark";

  /* =========================================================
     SELECTED USER
     ========================================================= */

  const selectedUser = currentConversation?.members.find(
    (member) => member.user.id !== currentUser?.id,
  )?.user;

  const isSelectedUserOnline = selectedUser
    ? onlineUserIds.includes(selectedUser.id)
    : false;

  /* =========================================================
     UNREAD MESSAGES
     ========================================================= */

  const unreadIncomingMessageIds = useMemo(() => {
    return messages
      .filter(
        (message) =>
          message.conversationId === currentConversationId &&
          message.senderId !== currentUser?.id &&
          !message.readAt,
      )
      .map((message) => message.id);
  }, [messages, currentConversationId, currentUser?.id]);

  const unreadIncomingSignature =
    unreadIncomingMessageIds.length > 0 && currentConversationId
      ? `${currentConversationId}:${unreadIncomingMessageIds.join(",")}`
      : null;

  /* =========================================================
     LOAD USERS
     ========================================================= */

  useEffect(() => {
    if (!token) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }

    let cancelled = false;

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

        if (!cancelled) {
          setUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch (error) {
        console.error("Fetch users error:", error);

        if (!cancelled) {
          setUsers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    };

    void fetchUsers();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* =========================================================
     FRIEND REQUEST COUNT
     ========================================================= */

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
      onNewRequest: () => void refreshFriendRequests(),
      onAccepted: () => void refreshFriendRequests(),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [token]);

  /* =========================================================
     LOAD MESSAGES
     ========================================================= */

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

        const fetchedMessages = Array.isArray(data.messages)
          ? data.messages
          : [];

        const mergedMessages = [
          ...fetchedMessages,
          ...existingMessages.filter(
            (existingMessage) =>
              existingMessage.conversationId === currentConversationId &&
              !fetchedMessages.some(
                (message: { id: string }) => message.id === existingMessage.id,
              ),
          ),
        ].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        setMessages(mergedMessages);
      } catch (error) {
        if (!cancelled) {
          console.error("Load messages error:", error);
        }
      }
    };

    void fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [currentConversationId, setMessages, token]);

  /* =========================================================
     READ RECEIPTS
     ========================================================= */

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

    if (lastReadReceiptSignatureRef.current === unreadIncomingSignature) {
      return;
    }

    lastReadReceiptSignatureRef.current = unreadIncomingSignature;

    readReceiptTimerRef.current = setTimeout(() => {
      socket.emit("conversation:read", {
        conversationId: currentConversationId,
      });

      readReceiptTimerRef.current = null;
    }, 100);

    return () => {
      if (readReceiptTimerRef.current) {
        clearTimeout(readReceiptTimerRef.current);
        readReceiptTimerRef.current = null;
      }
    };
  }, [currentConversationId, currentUser?.id, token, unreadIncomingSignature]);

  /* =========================================================
     TYPING INDICATOR
     ========================================================= */

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
    socket.on("userStoppedTyping", handleUserStoppedTyping);

    return () => {
      socket.off("userTyping", handleUserTyping);
      socket.off("userStoppedTyping", handleUserStoppedTyping);
      setTypingUser(null);
    };
  }, [currentConversationId, currentUser?.id]);

  /* =========================================================
     OPEN CONVERSATION
     ========================================================= */

  const openConversation = (conversation: {
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
    setMessages([]);

    setConversation({
      ...conversation,
      unreadCount: 0,
      messages: conversation.messages ?? [],
    });

    setMobileChatOpen(true);
  };

  const closeMobileChat = () => {
    setMobileChatOpen(false);
  };

  /* =========================================================
     START CONVERSATION
     ========================================================= */

  const startConversation = async (user: User) => {
    if (!token || creatingConversation) {
      return;
    }

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

      if (!data.conversation) {
        throw new Error("Server returned no conversation");
      }

      openConversation(data.conversation);
    } catch (error) {
      console.error("Start conversation error:", error);
    } finally {
      setCreatingConversation(false);
    }
  };

  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  const sendMessage = (text: string) => {
    const trimmedText = text.trim();

    if (!currentConversationId || !currentUser || !trimmedText) {
      return;
    }

    socket.emit("sendMessage", {
      conversationId: currentConversationId,
      text: trimmedText,
    });
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div
      className={`h-[100dvh] w-full overflow-hidden transition-colors duration-200 ${
        isDark ? "bg-[#070707] text-white" : "bg-[#f5f7fa] text-[#111827]"
      }`}
    >
      {/* HEADER */}

      <header
        className={`fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b px-4 sm:px-6 ${
          isDark
            ? "border-white/[0.08] bg-[#101010]"
            : "border-black/[0.08] bg-white"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold tracking-[0.15em] ${
              isDark ? "bg-white text-black" : "bg-black text-white"
            }`}
          >
            RT
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">
              Real-Time Chat
            </h1>

            <p
              className={`hidden text-[11px] sm:block ${
                isDark ? "text-white/40" : "text-black/40"
              }`}
            >
              Connected conversations
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/friends")}
            aria-label="Friends"
            title="Friends"
            className={`relative flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all active:scale-[0.98] ${
              isDark
                ? "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                : "border-black/[0.08] bg-black/[0.02] text-black/65 hover:bg-black/[0.05] hover:text-black"
            }`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <path d="M18 8v6" />
              <path d="M21 11h-6" />
            </svg>

            <span className="hidden sm:inline">Friends</span>

            {friendRequestCount > 0 && (
              <span
                className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  isDark ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                {friendRequestCount > 99 ? "99+" : friendRequestCount}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all active:scale-[0.98] ${
              isDark
                ? "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                : "border-black/[0.08] bg-black/[0.02] text-black/65 hover:bg-black/[0.05] hover:text-black"
            }`}
          >
            <span className="text-sm">{isDark ? "☀" : "☾"}</span>

            <span className="hidden sm:inline">
              {isDark ? "Light" : "Dark"}
            </span>
          </button>
        </div>
      </header>

      {/* MAIN */}

      <main className="h-[100dvh] w-full pt-16">
        <div
          className={`mx-auto flex h-[calc(100dvh-4rem)] w-full overflow-hidden sm:mt-4 sm:h-[calc(100dvh-5rem)] sm:max-w-[1500px] sm:rounded-2xl sm:border sm:shadow-2xl ${
            isDark
              ? "bg-[#101010] sm:border-white/[0.08]"
              : "bg-white sm:border-black/[0.08]"
          }`}
        >
          {/* SIDEBAR */}

          <aside
            className={`min-w-0 flex-col overflow-hidden border-r ${
              isDark ? "border-white/[0.08]" : "border-black/[0.08]"
            }
            ${
              mobileChatOpen
                ? "hidden md:flex"
                : "flex w-full md:w-[330px] md:flex-none lg:w-[360px]"
            }`}
          >
            {/* SIDEBAR HEADER */}

            <div
              className={`flex h-16 shrink-0 items-center border-b px-5 ${
                isDark ? "border-white/[0.08]" : "border-black/[0.08]"
              }`}
            >
              <div>
                <h2 className="text-sm font-semibold">Conversations</h2>

                <p
                  className={`mt-0.5 text-[11px] ${
                    isDark ? "text-white/40" : "text-black/40"
                  }`}
                >
                  Your recent chats
                </p>
              </div>
            </div>

            {/* CONVERSATION LIST
                This must be flex-1 + min-h-0 so scrolling works correctly.
            */}

            <div className="min-h-0 flex-1 overflow-hidden">
              <ConversationList
                onSelectConversation={openConversation}
                currentConversationId={currentConversationId}
                theme={theme}
              />
            </div>

            {/* QUICK CHAT */}

            <div
              className={`hidden shrink-0 border-t p-4 md:block ${
                isDark ? "border-white/[0.08]" : "border-black/[0.08]"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3
                  className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    isDark ? "text-white/35" : "text-black/40"
                  }`}
                >
                  Start a chat
                </h3>

                <span
                  className={`rounded-md px-2 py-1 text-[9px] font-medium ${
                    isDark
                      ? "bg-white/[0.06] text-white/40"
                      : "bg-black/[0.04] text-black/40"
                  }`}
                >
                  Quick
                </span>
              </div>

              {loadingUsers ? (
                <div
                  className={`flex items-center gap-2 text-xs ${
                    isDark ? "text-white/40" : "text-black/40"
                  }`}
                >
                  <span
                    className={`h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent ${
                      isDark ? "border-white/20" : "border-black/20"
                    }`}
                  />
                  Loading users...
                </div>
              ) : (
                (() => {
                  const quickUsers = users.filter(
                    (user) =>
                      user.username === "dhillon2317" &&
                      user.id !== currentUser?.id,
                  );

                  if (quickUsers.length === 0) {
                    return (
                      <p
                        className={`text-xs ${
                          isDark ? "text-white/40" : "text-black/40"
                        }`}
                      >
                        No other users found.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {quickUsers.map((user) => {
                        const isOnline = onlineUserIds.includes(user.id);

                        return (
                          <div
                            key={user.id}
                            className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                              isDark
                                ? "border-white/[0.06] bg-white/[0.02]"
                                : "border-black/[0.06] bg-black/[0.015]"
                            }`}
                          >
                            <div className="relative shrink-0">
                              <div
                                className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold ${
                                  isDark
                                    ? "bg-white/10 text-white"
                                    : "bg-black/5 text-black"
                                }`}
                              >
                                {user.username.slice(0, 2).toUpperCase()}
                              </div>

                              <span
                                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${
                                  isDark ? "border-[#101010]" : "border-white"
                                } ${
                                  isOnline
                                    ? "bg-emerald-500"
                                    : isDark
                                      ? "bg-white/20"
                                      : "bg-black/15"
                                }`}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {user.username}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => startConversation(user)}
                              disabled={creatingConversation}
                              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                                isDark
                                  ? "bg-white text-black hover:bg-white/90"
                                  : "bg-black text-white hover:bg-black/85"
                              }`}
                            >
                              {creatingConversation ? "..." : "Chat"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </aside>

          {/* CHAT PANEL */}

          <section
            className={`min-w-0 flex-1 flex-col overflow-hidden ${
              mobileChatOpen ? "flex" : "hidden md:flex"
            }`}
          >
            {!selectedUser || !currentConversationId ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-8">
                <div className="max-w-sm text-center">
                  <div
                    className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl ${
                      isDark ? "bg-white/[0.05]" : "bg-black/[0.04]"
                    }`}
                  >
                    💬
                  </div>

                  <h2 className="text-base font-semibold">
                    Select a conversation
                  </h2>

                  <p
                    className={`mt-2 text-sm leading-6 ${
                      isDark ? "text-white/40" : "text-black/45"
                    }`}
                  >
                    Choose a conversation from the sidebar to start messaging in
                    real time.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* CHAT HEADER */}

                <div
                  className={`flex h-16 shrink-0 items-center border-b px-4 sm:px-5 ${
                    isDark
                      ? "border-white/[0.08] bg-[#101010]"
                      : "border-black/[0.08] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={closeMobileChat}
                    aria-label="Back to conversations"
                    className={`mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl transition md:hidden ${
                      isDark
                        ? "text-white/50 hover:bg-white/[0.06] hover:text-white"
                        : "text-black/50 hover:bg-black/[0.05] hover:text-black"
                    }`}
                  >
                    ‹
                  </button>

                  <div className="relative mr-3 shrink-0">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
                        isDark
                          ? "bg-white/10 text-white"
                          : "bg-black/5 text-black"
                      }`}
                    >
                      {selectedUser.username.slice(0, 2).toUpperCase()}
                    </div>

                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${
                        isDark ? "border-[#101010]" : "border-white"
                      } ${
                        isSelectedUserOnline
                          ? "bg-emerald-500"
                          : isDark
                            ? "bg-white/20"
                            : "bg-black/15"
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      {selectedUser.username}
                    </h2>

                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelectedUserOnline
                            ? "bg-emerald-500"
                            : isDark
                              ? "bg-white/20"
                              : "bg-black/20"
                        }`}
                      />

                      <span
                        className={`text-[10px] font-medium ${
                          isSelectedUserOnline
                            ? "text-emerald-500"
                            : isDark
                              ? "text-white/40"
                              : "text-black/40"
                        }`}
                      >
                        {isSelectedUserOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MESSAGES */}

                <div
                  className={`min-h-0 flex-1 overflow-y-auto ${
                    isDark ? "bg-[#0b0b0b]" : "bg-[#fafafa]"
                  }`}
                >
                  <ChatMessages
                    messages={messages}
                    currentUserId={currentUser?.id ?? ""}
                  />
                </div>

                {/* TYPING */}

                {typingUser && typingUser.userId !== currentUser?.id && (
                  <div
                    className={`shrink-0 border-t px-4 py-2 ${
                      isDark
                        ? "border-white/[0.08] bg-[#101010]"
                        : "border-black/[0.08] bg-white"
                    }`}
                  >
                    <div className="mx-auto max-w-4xl">
                      <TypingIndicator username={typingUser.username} />
                    </div>
                  </div>
                )}

                {/* MESSAGE INPUT */}

                <div
                  className={`shrink-0 border-t p-3 sm:p-4 ${
                    isDark
                      ? "border-white/[0.08] bg-[#101010]"
                      : "border-black/[0.08] bg-white"
                  }`}
                >
                  <div className="mx-auto w-full max-w-4xl">
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
