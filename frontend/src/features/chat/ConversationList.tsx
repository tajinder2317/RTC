import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "../auth/authStore";
import { socket } from "../../services/socket";
import { getUsers, createConversation } from "../../services/api";

import type { Conversation, ChatUser } from "./chatStore";

import { usePresenceStore } from "../presence/presenceStore";

type ConversationListProps = {
  onSelectConversation: (conversation: Conversation) => void;
  currentConversationId: string | null;
};

type NewMessagePayload = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
};

type MessageReadPayload = {
  conversationId: string;
  messageIds: string[];
  readAt: string;
};

export default function ConversationList({
  onSelectConversation,
  currentConversationId,
}: ConversationListProps) {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const onlineUserIds = usePresenceStore(
    (state) => state.onlineUserIds,
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(
    null,
  );

  /* =========================================================
     HELPERS
     ========================================================= */

  const getOtherUser = (
    conversation: Conversation,
  ): ChatUser | undefined => {
    return conversation.members.find(
      (member) => member.user.id !== currentUser?.id,
    )?.user;
  };

  const getConversationPairKey = (
    conversation: Conversation,
  ): string | null => {
    const memberIds = conversation.members
      .map((member) => member.user.id)
      .filter(Boolean)
      .sort();

    if (memberIds.length !== 2) {
      return null;
    }

    return `${memberIds[0]}:${memberIds[1]}`;
  };

  const normalizeConversations = (
    input: Conversation[],
  ): Conversation[] => {
    const byConversationId = new Map<string, Conversation>();

    for (const conversation of input) {
      if (!conversation?.id) continue;

      const normalized: Conversation = {
        ...conversation,
        messages: [...(conversation.messages ?? [])].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      };

      const existing = byConversationId.get(conversation.id);

      if (!existing) {
        byConversationId.set(conversation.id, normalized);
        continue;
      }

      const messageMap = new Map(
        [...(existing.messages ?? []), ...(normalized.messages ?? [])].map(
          (message) => [message.id, message],
        ),
      );

      byConversationId.set(conversation.id, {
        ...existing,
        ...normalized,
        unreadCount: Math.max(
          existing.unreadCount ?? 0,
          normalized.unreadCount ?? 0,
        ),
        messages: [...messageMap.values()].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      });
    }

    const byPair = new Map<string, Conversation>();

    for (const conversation of byConversationId.values()) {
      const pairKey = getConversationPairKey(conversation);

      if (!pairKey) {
        byPair.set(`conversation:${conversation.id}`, conversation);
        continue;
      }

      const existing = byPair.get(pairKey);

      if (!existing) {
        byPair.set(pairKey, conversation);
        continue;
      }

      const existingLatest =
        existing.messages?.[0]?.createdAt ?? existing.createdAt;

      const currentLatest =
        conversation.messages?.[0]?.createdAt ?? conversation.createdAt;

      if (
        new Date(currentLatest).getTime() >
        new Date(existingLatest).getTime()
      ) {
        byPair.set(pairKey, conversation);
      }
    }

    return [...byPair.values()].sort((a, b) => {
      const aDate = a.messages?.[0]?.createdAt ?? a.createdAt;
      const bDate = b.messages?.[0]?.createdAt ?? b.createdAt;

      return (
        new Date(bDate).getTime() -
        new Date(aDate).getTime()
      );
    });
  };

  /* =========================================================
     LOAD CONVERSATIONS
     ========================================================= */

  useEffect(() => {
    if (!token) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadConversations = async () => {
      try {
        setLoading(true);

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
          throw new Error(
            data.message || "Failed to fetch conversations",
          );
        }

        if (cancelled) return;

        const loaded: Conversation[] = Array.isArray(
          data.conversations,
        )
          ? data.conversations
          : [];

        setConversations(normalizeConversations(loaded));
      } catch (error) {
        if (!cancelled) {
          console.error("Fetch conversations error:", error);
          setConversations([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* =========================================================
     LOAD USERS
     ========================================================= */

  useEffect(() => {
    if (!token) {
      setUsers([]);
      return;
    }

    let cancelled = false;

    const loadUsers = async () => {
      try {
        setUsersLoading(true);

        const data = await getUsers(token);

        if (!cancelled) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Fetch users error:", error);
          setUsers([]);
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* =========================================================
     CLEAR UNREAD
     ========================================================= */

  useEffect(() => {
    if (!currentConversationId) return;

    setConversations((previous) =>
      previous.map((conversation) =>
        conversation.id === currentConversationId
          ? {
              ...conversation,
              unreadCount: 0,
            }
          : conversation,
      ),
    );
  }, [currentConversationId]);

  /* =========================================================
     NEW MESSAGE
     ========================================================= */

  useEffect(() => {
    const handleNewMessage = (message: NewMessagePayload) => {
      if (!message?.conversationId) return;

      setConversations((previous) => {
        const existing = previous.find(
          (conversation) =>
            conversation.id === message.conversationId,
        );

        if (!existing) {
          return previous;
        }

        const isCurrent =
          message.conversationId === currentConversationId;

        const isMine = message.senderId === currentUser?.id;

        const unreadCount =
          isCurrent || isMine
            ? 0
            : (existing.unreadCount ?? 0) + 1;

        const nextMessage = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          text: message.text,
          createdAt: message.createdAt,
          deliveredAt: message.deliveredAt ?? null,
          readAt: message.readAt ?? null,
        };

        const messages = [
          nextMessage,
          ...(existing.messages ?? []).filter(
            (item) => item.id !== message.id,
          ),
        ];

        const updated: Conversation = {
          ...existing,
          unreadCount,
          messages,
        };

        return normalizeConversations([
          updated,
          ...previous.filter(
            (conversation) =>
              conversation.id !== message.conversationId,
          ),
        ]);
      });
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [currentConversationId, currentUser?.id]);

  /* =========================================================
     READ RECEIPTS
     ========================================================= */

  useEffect(() => {
    const handleMessageRead = (
      payload: MessageReadPayload,
    ) => {
      if (
        !payload?.conversationId ||
        !Array.isArray(payload.messageIds) ||
        payload.messageIds.length === 0
      ) {
        return;
      }

      const messageIdSet = new Set(payload.messageIds);

      setConversations((previous) =>
        previous.map((conversation) => {
          if (conversation.id !== payload.conversationId) {
            return conversation;
          }

          return {
            ...conversation,
            unreadCount: 0,
            messages: (conversation.messages ?? []).map(
              (message) =>
                messageIdSet.has(message.id)
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

  /* =========================================================
     SELECT
     ========================================================= */

  const handleSelectConversation = (
    conversation: Conversation,
  ) => {
    const updatedConversation: Conversation = {
      ...conversation,
      unreadCount: 0,
      messages: conversation.messages ?? [],
    };

    setConversations((previous) =>
      previous.map((item) =>
        item.id === conversation.id
          ? updatedConversation
          : item,
      ),
    );

    onSelectConversation(updatedConversation);
  };

  /* =========================================================
     START CHAT
     ========================================================= */

  const handleStartChat = async (user: ChatUser) => {
    if (!token || startingChat) return;

    try {
      setStartingChat(user.id);

      const conversation = await createConversation(
        token,
        user.id,
      );

      const normalizedConversation: Conversation = {
        ...conversation,
        unreadCount: 0,
        messages: conversation.messages ?? [],
      };

      setConversations((previous) =>
        normalizeConversations([
          normalizedConversation,
          ...previous,
        ]),
      );

      onSelectConversation(normalizedConversation);

      setSearch("");
    } catch (error) {
      console.error("Start conversation error:", error);
    } finally {
      setStartingChat(null);
    }
  };

  /* =========================================================
     SEARCH
     ========================================================= */

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return [];
    }

    const existingUserIds = new Set<string>();

    conversations.forEach((conversation) => {
      const otherUser = getOtherUser(conversation);

      if (otherUser) {
        existingUserIds.add(otherUser.id);
      }
    });

    return users
      .filter(
        (user) =>
          user.id !== currentUser?.id &&
          !existingUserIds.has(user.id),
      )
      .filter((user) => {
        const username = user.username.toLowerCase();
        const email = user.email.toLowerCase();

        return (
          username.includes(query) ||
          email.includes(query)
        );
      })
      .slice(0, 8);
  }, [
    conversations,
    currentUser?.id,
    search,
    users,
  ]);

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-black/40 dark:text-white/40">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/10 border-t-black dark:border-white/10 dark:border-t-white" />
          <span>Loading conversations...</span>
        </div>
      </div>
    );
  }

  /* =========================================================
     UI
     ========================================================= */

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* =====================================================
          SEARCH
          ===================================================== */}

      <div className="relative shrink-0 border-b border-black/[0.06] p-4 dark:border-white/[0.06]">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30 dark:text-white/30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search users..."
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-black/[0.08] bg-black/[0.025] pl-10 pr-9 text-xs text-black outline-none transition placeholder:text-black/30 focus:border-black/20 focus:bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-white/25 dark:focus:border-white/20 dark:focus:bg-white/[0.04]"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-base leading-none text-black/35 transition hover:bg-black/[0.06] hover:text-black/70 dark:text-white/35 dark:hover:bg-white/[0.06] dark:hover:text-white/70"
            >
              ×
            </button>
          )}
        </div>

        {/* ===================================================
            SEARCH RESULTS
            =================================================== */}

        {search.trim() && (
          <div className="absolute left-3 right-3 top-[4.25rem] z-30 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xl shadow-black/10 dark:border-white/[0.08] dark:bg-[#151515] dark:shadow-black/40">
            {usersLoading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-xs text-black/40 dark:text-white/40">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15 border-t-black dark:border-white/15 dark:border-t-white" />
                Searching...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-4 py-4 text-xs text-black/40 dark:text-white/40">
                No users found
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto p-2">
                {filteredUsers.map((user) => {
                  const isOnline =
                    onlineUserIds.includes(user.id);

                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 rounded-lg p-2.5 transition hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] text-[10px] font-semibold text-black dark:bg-white/[0.08] dark:text-white">
                          {user.username
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <span
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#151515] ${
                            isOnline
                              ? "bg-emerald-500"
                              : "bg-black/15 dark:bg-white/20"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-black dark:text-white">
                          {user.username}
                        </p>

                        <p className="truncate text-[10px] text-black/40 dark:text-white/35">
                          {user.email}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleStartChat(user)
                        }
                        disabled={startingChat !== null}
                        className="shrink-0 rounded-lg border-0 bg-black px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/85"
                      >
                        {startingChat === user.id
                          ? "..."
                          : "Chat"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          CONVERSATIONS
          ===================================================== */}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="max-w-[220px] text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-black/[0.04] text-lg dark:bg-white/[0.04]">
                💬
              </div>

              <p className="text-xs font-semibold text-black dark:text-white">
                No conversations yet
              </p>

              <p className="mt-1.5 text-[11px] leading-5 text-black/40 dark:text-white/35">
                Search for someone above to start chatting.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => {
              const otherUser =
                getOtherUser(conversation);

              if (!otherUser) {
                return null;
              }

              const lastMessage =
                conversation.messages?.[0];

              const isSelected =
                conversation.id ===
                currentConversationId;

              const isOnline =
                onlineUserIds.includes(otherUser.id);

              const unreadCount =
                conversation.unreadCount ?? 0;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() =>
                    handleSelectConversation(
                      conversation,
                    )
                  }
                  className={`group relative flex w-full items-center gap-3 rounded-xl border-0 px-3 py-3 text-left transition ${
                    isSelected
                      ? "bg-black/[0.06] dark:bg-white/[0.07]"
                      : "bg-transparent hover:bg-black/[0.035] dark:hover:bg-white/[0.035]"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-black dark:bg-white" />
                  )}

                  {/* AVATAR */}

                  <div className="relative shrink-0">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-[11px] font-semibold ${
                        isSelected
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "bg-black/[0.06] text-black dark:bg-white/[0.08] dark:text-white"
                      }`}
                    >
                      {otherUser.username
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 ${
                        isSelected
                          ? "border-[#f0f0f0] dark:border-[#191919]"
                          : "border-white dark:border-[#101010]"
                      } ${
                        isOnline
                          ? "bg-emerald-500"
                          : "bg-black/15 dark:bg-white/20"
                      }`}
                    />
                  </div>

                  {/* CONTENT */}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-xs font-semibold ${
                          isSelected
                            ? "text-black dark:text-white"
                            : "text-black/80 dark:text-white/80"
                        }`}
                      >
                        {otherUser.username}
                      </span>

                      {unreadCount > 0 && (
                        <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-black px-1.5 py-0.5 text-[9px] font-bold text-white dark:bg-white dark:text-black">
                          {unreadCount > 99
                            ? "99+"
                            : unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span
                        className={`shrink-0 text-[10px] font-medium ${
                          isOnline
                            ? "text-emerald-500"
                            : "text-black/30 dark:text-white/25"
                        }`}
                      >
                        {isOnline
                          ? "Online"
                          : "Offline"}
                      </span>

                      <span className="shrink-0 text-[9px] text-black/20 dark:text-white/20">
                        •
                      </span>

                      <p
                        className={`truncate text-[10px] ${
                          unreadCount > 0
                            ? "font-medium text-black/70 dark:text-white/70"
                            : "text-black/35 dark:text-white/30"
                        }`}
                      >
                        {lastMessage?.text ||
                          "No messages yet"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}