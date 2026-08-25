import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "../auth/authStore";
import { socket } from "../../services/socket";
import {
  getUsers,
  createConversation,
} from "../../services/api";
import type {
  Conversation,
  ChatUser,
} from "./chatStore";
import { usePresenceStore } from "../presence/presenceStore";

type ConversationListProps = {
  onSelectConversation: (
    conversation: Conversation,
  ) => void;
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
  const token = useAuthStore(
    (state) => state.token,
  );

  const currentUser = useAuthStore(
    (state) => state.user,
  );

  const onlineUserIds = usePresenceStore(
    (state) => state.onlineUserIds,
  );

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] =
    useState(false);

  const [startingChat, setStartingChat] =
    useState<string | null>(null);

  /* =========================================================
     HELPERS
     ========================================================= */

  const getOtherUser = (
    conversation: Conversation,
  ): ChatUser | undefined => {
    return conversation.members.find(
      (member) =>
        member.user.id !== currentUser?.id,
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
    const byConversationId = new Map<
      string,
      Conversation
    >();

    for (const conversation of input) {
      if (!conversation?.id) continue;

      const normalized: Conversation = {
        ...conversation,
        messages: [
          ...(conversation.messages ?? []),
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      };

      const existing =
        byConversationId.get(conversation.id);

      if (!existing) {
        byConversationId.set(
          conversation.id,
          normalized,
        );
        continue;
      }

      const messageMap = new Map(
        [
          ...(existing.messages ?? []),
          ...(normalized.messages ?? []),
        ].map((message) => [
          message.id,
          message,
        ]),
      );

      byConversationId.set(
        conversation.id,
        {
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
        },
      );
    }

    const byPair = new Map<
      string,
      Conversation
    >();

    for (const conversation of byConversationId.values()) {
      const pairKey =
        getConversationPairKey(conversation);

      if (!pairKey) {
        byPair.set(
          `conversation:${conversation.id}`,
          conversation,
        );
        continue;
      }

      const existing = byPair.get(pairKey);

      if (!existing) {
        byPair.set(pairKey, conversation);
        continue;
      }

      const existingLatest =
        existing.messages?.[0]?.createdAt ??
        existing.createdAt;

      const currentLatest =
        conversation.messages?.[0]?.createdAt ??
        conversation.createdAt;

      if (
        new Date(currentLatest).getTime() >
        new Date(existingLatest).getTime()
      ) {
        byPair.set(pairKey, conversation);
      }
    }

    return [...byPair.values()].sort((a, b) => {
      const aDate =
        a.messages?.[0]?.createdAt ??
        a.createdAt;

      const bDate =
        b.messages?.[0]?.createdAt ??
        b.createdAt;

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
            data.message ||
              "Failed to fetch conversations",
          );
        }

        if (cancelled) return;

        const loaded: Conversation[] =
          Array.isArray(data.conversations)
            ? data.conversations
            : [];

        setConversations(
          normalizeConversations(loaded),
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Fetch conversations error:",
            error,
          );

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
          setUsers(
            Array.isArray(data) ? data : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Fetch users error:",
            error,
          );

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
    const handleNewMessage = (
      message: NewMessagePayload,
    ) => {
      if (!message?.conversationId) return;

      setConversations((previous) => {
        const existing = previous.find(
          (conversation) =>
            conversation.id ===
            message.conversationId,
        );

        if (!existing) {
          return previous;
        }

        const isCurrent =
          message.conversationId ===
          currentConversationId;

        const isMine =
          message.senderId === currentUser?.id;

        const unreadCount =
          isCurrent || isMine
            ? 0
            : (existing.unreadCount ?? 0) + 1;

        const nextMessage = {
          id: message.id,
          conversationId:
            message.conversationId,
          senderId: message.senderId,
          text: message.text,
          createdAt: message.createdAt,
          deliveredAt:
            message.deliveredAt ?? null,
          readAt: message.readAt ?? null,
        };

        const messages = [
          nextMessage,
          ...(existing.messages ?? []).filter(
            (item) =>
              item.id !== message.id,
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
              conversation.id !==
              message.conversationId,
          ),
        ]);
      });
    };

    socket.on(
      "newMessage",
      handleNewMessage,
    );

    return () => {
      socket.off(
        "newMessage",
        handleNewMessage,
      );
    };
  }, [
    currentConversationId,
    currentUser?.id,
  ]);

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

      const messageIdSet = new Set(
        payload.messageIds,
      );

      setConversations((previous) =>
        previous.map((conversation) => {
          if (
            conversation.id !==
            payload.conversationId
          ) {
            return conversation;
          }

          return {
            ...conversation,
            unreadCount: 0,
            messages: (
              conversation.messages ?? []
            ).map((message) =>
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

    socket.on(
      "message:read",
      handleMessageRead,
    );

    return () => {
      socket.off(
        "message:read",
        handleMessageRead,
      );
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

    onSelectConversation(
      updatedConversation,
    );
  };

  /* =========================================================
     START CHAT
     ========================================================= */

  const handleStartChat = async (
    user: ChatUser,
  ) => {
    if (!token || startingChat) return;

    try {
      setStartingChat(user.id);

      const conversation =
        await createConversation(
          token,
          user.id,
        );

      const normalizedConversation: Conversation =
        {
          ...conversation,
          unreadCount: 0,
          messages:
            conversation.messages ?? [],
        };

      setConversations((previous) =>
        normalizeConversations([
          normalizedConversation,
          ...previous,
        ]),
      );

      onSelectConversation(
        normalizedConversation,
      );

      setSearch("");
    } catch (error) {
      console.error(
        "Start conversation error:",
        error,
      );
    } finally {
      setStartingChat(null);
    }
  };

  /* =========================================================
     SEARCH
     ========================================================= */

  const filteredUsers = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) return [];

    const existingUserIds =
      new Set<string>();

    conversations.forEach(
      (conversation) => {
        const otherUser =
          getOtherUser(conversation);

        if (otherUser) {
          existingUserIds.add(
            otherUser.id,
          );
        }
      },
    );

    return users
      .filter(
        (user) =>
          user.id !== currentUser?.id &&
          !existingUserIds.has(user.id),
      )
      .filter((user) => {
        const username =
          user.username.toLowerCase();

        const email =
          user.email.toLowerCase();

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
      <div className="rtc-conversation-list">
        <div className="rtc-muted-row">
          <span className="rtc-spinner" />
          <span>
            Loading conversations...
          </span>
        </div>
      </div>
    );
  }

  /* =========================================================
     UI
     ========================================================= */

  return (
    <div className="rtc-conversation-list">
      {/* SEARCH */}

      <div className="rtc-conversation-search">
        <div className="rtc-search-wrapper">
          <svg
            className="rtc-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
            />

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
            className="rtc-search-input"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="rtc-search-clear"
            >
              ×
            </button>
          )}
        </div>

        {search.trim() && (
          <div className="rtc-search-results">
            {usersLoading ? (
              <div className="rtc-muted-row">
                <span className="rtc-spinner" />
                <span>Searching...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rtc-muted-row">
                No users found
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isOnline =
                  onlineUserIds.includes(
                    user.id,
                  );

                return (
                  <div
                    key={user.id}
                    className="rtc-search-user"
                  >
                    <div className="relative shrink-0">
                      <div className="rtc-avatar rtc-avatar-search">
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

                      <p className="rtc-user-email">
                        {user.email}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleStartChat(user)
                      }
                      disabled={
                        startingChat !== null
                      }
                      className="rtc-small-button"
                    >
                      {startingChat ===
                      user.id
                        ? "..."
                        : "Chat"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* CONVERSATIONS */}

      <div className="rtc-conversation-scroll">
        {conversations.length === 0 ? (
          <div className="rtc-no-conversations">
            <div className="rtc-empty-small-icon">
              💬
            </div>

            <p className="rtc-muted-title">
              No conversations yet
            </p>

            <p className="rtc-muted-description">
              Search for someone above to
              start chatting.
            </p>
          </div>
        ) : (
          <div>
            {conversations.map(
              (conversation) => {
                const otherUser =
                  getOtherUser(
                    conversation,
                  );

                if (!otherUser) return null;

                const lastMessage =
                  conversation.messages?.[0];

                const isSelected =
                  conversation.id ===
                  currentConversationId;

                const isOnline =
                  onlineUserIds.includes(
                    otherUser.id,
                  );

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
                    className={`rtc-conversation-item ${
                      isSelected
                        ? "is-selected"
                        : ""
                    }`}
                  >
                    {isSelected && (
                      <span className="rtc-selection-indicator" />
                    )}

                    <div className="relative shrink-0">
                      <div
                        className={`rtc-avatar ${
                          isSelected
                            ? "is-selected"
                            : ""
                        }`}
                      >
                        {otherUser.username
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
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rtc-conversation-name ${
                            isSelected
                              ? "is-selected"
                              : ""
                          }`}
                        >
                          {otherUser.username}
                        </span>

                        {unreadCount > 0 && (
                          <span className="rtc-count-badge">
                            {unreadCount >
                            99
                              ? "99+"
                              : unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`rtc-conversation-status ${
                            isOnline
                              ? "is-online"
                              : ""
                          }`}
                        >
                          {isOnline
                            ? "Online"
                            : "Offline"}
                        </span>

                        <span className="rtc-separator">
                          •
                        </span>

                        <p className="rtc-last-message">
                          {lastMessage?.text ||
                            "No messages yet"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}