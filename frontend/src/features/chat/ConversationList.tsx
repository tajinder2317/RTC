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

  const [conversations, setConversations] = useState<
    Conversation[]
  >([]);

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(
    null,
  );

  // ============================================================
  // LOAD CONVERSATIONS
  // ============================================================

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

        if (!cancelled) {
          const loadedConversations: Conversation[] =
            Array.isArray(data.conversations)
              ? data.conversations
              : [];

          // Remove duplicate conversation IDs.
          const uniqueConversations: Conversation[] = [];

          const seenConversationIds = new Set<string>();

          for (const conversation of loadedConversations) {
            if (seenConversationIds.has(conversation.id)) {
              continue;
            }

            seenConversationIds.add(conversation.id);
            uniqueConversations.push(conversation);
          }

          setConversations(uniqueConversations);
        }
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

  // ============================================================
  // LOAD USERS FOR SEARCH
  // ============================================================

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

  // ============================================================
  // CLEAR SELECTED CONVERSATION UNREAD COUNT
  // ============================================================

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

  // ============================================================
  // REAL-TIME NEW MESSAGE
  // ============================================================

  useEffect(() => {
    const handleNewMessage = (
      message: NewMessagePayload,
    ) => {
      setConversations((previous) => {
        const existing = previous.find(
          (conversation) =>
            conversation.id === message.conversationId,
        );

        if (!existing) {
          return previous;
        }

        const isCurrentConversation =
          message.conversationId === currentConversationId;

        const isMine =
          message.senderId === currentUser?.id;

        const unreadCount =
          isCurrentConversation || isMine
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
          ...existing.messages.filter(
            (item) => item.id !== message.id,
          ),
        ];

        const updatedConversation: Conversation = {
          ...existing,
          unreadCount,
          messages,
        };

        return [
          updatedConversation,
          ...previous.filter(
            (conversation) =>
              conversation.id !== message.conversationId,
          ),
        ];
      });
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [currentConversationId, currentUser?.id]);

  // ============================================================
  // REAL-TIME READ RECEIPTS
  // ============================================================

  useEffect(() => {
    const handleMessageRead = (
      payload: MessageReadPayload,
    ) => {
      if (
        !payload.conversationId ||
        payload.messageIds.length === 0
      ) {
        return;
      }

      setConversations((previous) =>
        previous.map((conversation) => {
          if (
            conversation.id !== payload.conversationId
          ) {
            return conversation;
          }

          return {
            ...conversation,
            unreadCount: 0,
            messages: conversation.messages.map(
              (message) =>
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

  // ============================================================
  // HELPERS
  // ============================================================

  const getOtherUser = (
    conversation: Conversation,
  ): ChatUser | undefined => {
    return conversation.members.find(
      (member) =>
        member.user.id !== currentUser?.id,
    )?.user;
  };

  const markConversationRead = async (
    conversationId: string,
  ) => {
    if (!token) return;

    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/conversations/${conversationId}/read`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (error) {
      console.error(
        "Mark conversation read error:",
        error,
      );
    }
  };

  // ============================================================
  // SELECT CONVERSATION
  // ============================================================

  const handleSelectConversation = async (
    conversation: Conversation,
  ) => {
    const updatedConversation: Conversation = {
      ...conversation,
      unreadCount: 0,
    };

    setConversations((previous) =>
      previous.map((item) =>
        item.id === conversation.id
          ? updatedConversation
          : item,
      ),
    );

    onSelectConversation(updatedConversation);

    await markConversationRead(conversation.id);
  };

  // ============================================================
  // START CONVERSATION
  // ============================================================

  const handleStartChat = async (
    user: ChatUser,
  ) => {
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

      setConversations((previous) => {
        const existingIndex = previous.findIndex(
          (item) =>
            item.id === normalizedConversation.id,
        );

        if (existingIndex === -1) {
          return [
            normalizedConversation,
            ...previous,
          ];
        }

        return previous.map((item) =>
          item.id === normalizedConversation.id
            ? normalizedConversation
            : item,
        );
      });

      onSelectConversation(normalizedConversation);

      await markConversationRead(
        normalizedConversation.id,
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

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

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

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="rtc-conversation-list">
        <div className="rtc-muted-row">
          <span className="rtc-spinner" />
          <span>Loading conversations...</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="rtc-conversation-list">

      {/* SEARCH */}

      <div className="rtc-conversation-search">
        <div className="relative">
          <svg
            className="rtc-search-icon"
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
            className="rtc-search-input"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-white/40 hover:text-white"
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
                  onlineUserIds.includes(user.id);

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
                          isOnline ? "is-online" : ""
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
                      disabled={startingChat !== null}
                      className="rtc-small-button"
                    >
                      {startingChat === user.id
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
              Search for someone above to start chatting.
            </p>
          </div>
        ) : (
          <div>
            {conversations.map((conversation) => {
              const otherUser =
                getOtherUser(conversation);

              if (!otherUser) return null;

              const lastMessage =
                conversation.messages[0];

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
                          {unreadCount > 99
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}