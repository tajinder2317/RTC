import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/authStore";
import { useChatStore } from "../chat/chatStore";
import {
  acceptFriendRequest,
  createConversation,
  getFriendRequests,
  getFriends,
  removeFriend,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  type Friend,
  type FriendRequest,
  type RelationshipStatus,
  type SocialUser,
} from "../../services/api";
import FriendList from "./FriendList";
import FriendRequests from "./FriendRequests";
import { subscribeToFriendEvents } from "./friendsRealtime";
import { usePresenceStore } from "../presence/presenceStore";

type TabKey = "friends" | "requests" | "search";
type ActionType = "send" | "accept" | "reject" | "remove" | null;
type NoticeKind = "success" | "error";
type UserCard = {
  id: string;
  username: string;
  email: string;
};

const statusLabel: Record<RelationshipStatus, string> = {
  SELF: "You",
  FRIENDS: "Friends",
  REQUEST_SENT: "Request Sent",
  REQUEST_RECEIVED: "Request Received",
  NOT_FRIENDS: "Add Friend",
};

export default function Friends() {
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const setConversation = useChatStore((state) => state.setConversation);
  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);

  const [tab, setTab] = useState<TabKey>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [activeAction, setActiveAction] = useState<{
    type: ActionType;
    id: string | null;
  }>({
    type: null,
    id: null,
  });
  const [notice, setNotice] = useState<{
    kind: NoticeKind;
    message: string;
  } | null>(null);

  const searchRequestIdRef = useRef(0);

  const pendingCount = requests.length;
  const trimmedSearch = searchInput.trim();

  const showNotice = (kind: NoticeKind, message: string) => {
    setNotice({
      kind,
      message,
    });
  };

  const executeSearch = async (
    query: string,
    requestId: number,
    showLoading: boolean,
  ) => {
    if (!token) {
      return;
    }

    if (showLoading) {
      setLoadingSearch(true);
    }

    try {
      const data = await searchUsers(token, query);
      if (requestId === searchRequestIdRef.current) {
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Search users error:", error);
      if (requestId === searchRequestIdRef.current) {
        showNotice("error", "Unable to search users");
      }
    } finally {
      if (requestId === searchRequestIdRef.current && showLoading) {
        setLoadingSearch(false);
      }
    }
  };

  const refreshFriends = async () => {
    if (!token) {
      setFriends([]);
      return;
    }

    try {
      setLoadingFriends(true);
      const data = await getFriends(token);
      setFriends(data);
    } catch (error) {
      console.error("Load friends error:", error);
      showNotice("error", "Unable to load friends");
    } finally {
      setLoadingFriends(false);
    }
  };

  const refreshRequests = async () => {
    if (!token) {
      setRequests([]);
      return;
    }

    try {
      setLoadingRequests(true);
      const data = await getFriendRequests(token);
      setRequests(data);
    } catch (error) {
      console.error("Load requests error:", error);
      showNotice("error", "Unable to load friend requests");
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoadingFriends(false);
      setLoadingRequests(false);
      return;
    }

    void refreshFriends();
    void refreshRequests();
  }, [token]);

  useEffect(() => {
    if (!token) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }

    if (!trimmedSearch) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    setLoadingSearch(true);

    const timer = setTimeout(() => {
      void executeSearch(trimmedSearch, requestId, true);
    }, 300);

    return () => clearTimeout(timer);
  }, [token, trimmedSearch]);

  useEffect(() => {
    const unsubscribe = subscribeToFriendEvents({
      onNewRequest: () => {
        void refreshRequests();
        if (trimmedSearch) {
          void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
        }
      },
      onAccepted: () => {
        void refreshFriends();
        void refreshRequests();
        if (trimmedSearch) {
          void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
        }
      },
    });

    return unsubscribe;
  }, [token, trimmedSearch]);

  const openConversation = async (friend: UserCard) => {
    if (!token) return;

    try {
      setActiveAction({ type: "send", id: friend.id });
      const conversation = await createConversation(token, friend.id);
      setConversation(conversation);
      navigate("/chat");
    } catch (error) {
      console.error("Open conversation error:", error);
      showNotice("error", "Failed to open chat");
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const handleAddFriend = async (userId: string) => {
    if (!token) return;

    try {
      setActiveAction({ type: "send", id: userId });
      const data = await sendFriendRequest(token, userId);
      showNotice("success", data.message || "Friend request sent");
      await refreshRequests();
      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Send friend request error:", error);
      showNotice("error", error instanceof Error ? error.message : "Failed to send friend request");
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const handleAccept = async (request: FriendRequest) => {
    if (!token) return;

    try {
      setActiveAction({ type: "accept", id: request.id });
      const data = await acceptFriendRequest(token, request.id);
      showNotice("success", data.message || "Friend request accepted");
      await refreshFriends();
      await refreshRequests();
      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Accept friend request error:", error);
      showNotice("error", error instanceof Error ? error.message : "Failed to accept request");
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const handleReject = async (request: FriendRequest) => {
    if (!token) return;

    try {
      setActiveAction({ type: "reject", id: request.id });
      const data = await rejectFriendRequest(token, request.id);
      showNotice("success", data.message || "Friend request rejected");
      await refreshRequests();
      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Reject friend request error:", error);
      showNotice("error", error instanceof Error ? error.message : "Failed to reject request");
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const handleRemoveFriend = async (friend: Friend) => {
    if (!token) return;

    try {
      setActiveAction({ type: "remove", id: friend.id });
      const data = await removeFriend(token, friend.id);
      showNotice("success", data.message || "Friend removed");
      await refreshFriends();
      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Remove friend error:", error);
      showNotice("error", error instanceof Error ? error.message : "Failed to remove friend");
    } finally {
      setActiveAction({ type: null, id: null });
    }
  };

  const isBusy = (id: string) => activeAction.id === id && activeAction.type !== null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        padding: "32px",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Friends</h1>
            <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
              Manage requests, friends, and new connections.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => navigate("/chat")}
              style={{
                border: "1px solid #d1d5db",
                background: "white",
                borderRadius: "10px",
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              Back to Chat
            </button>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#111827",
                color: "white",
                fontSize: "14px",
              }}
            >
              {currentUser?.username}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr",
            gap: "20px",
          }}
        >
          <aside
            style={{
              background: "white",
              borderRadius: "18px",
              padding: "18px",
              border: "1px solid #e5e7eb",
              height: "fit-content",
            }}
          >
            <div style={{ display: "grid", gap: "10px" }}>
              {([
                ["friends", "My Friends", friends.length],
                ["requests", "Requests", pendingCount],
                ["search", "Search Users", undefined],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid",
                    borderColor: tab === key ? "#2563eb" : "#e5e7eb",
                    background: tab === key ? "#eff6ff" : "white",
                    color: "#111827",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  <span>{label}</span>
                  {typeof count === "number" && count > 0 ? (
                    <span
                      style={{
                        minWidth: "24px",
                        height: "24px",
                        borderRadius: "999px",
                        background: "#2563eb",
                        color: "white",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                      }}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </aside>

          <main
            style={{
              background: "white",
              borderRadius: "18px",
              padding: "20px",
              border: "1px solid #e5e7eb",
              minHeight: "70vh",
            }}
          >
            {notice && (
              <div
                style={{
                  marginBottom: "16px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: notice.kind === "error" ? "#fef2f2" : "#ecfeff",
                  border: notice.kind === "error" ? "1px solid #fecaca" : "1px solid #a5f3fc",
                  color: notice.kind === "error" ? "#b91c1c" : "#155e75",
                }}
              >
                {notice.message}
              </div>
            )}

            {tab === "friends" && (
              <FriendList
                friends={friends}
                loading={loadingFriends}
                onMessage={openConversation}
                onRemove={handleRemoveFriend}
                emptyTitle="No friends yet."
                emptySubtitle="Search for someone to add them as a friend."
              />
            )}

            {tab === "requests" && (
              <FriendRequests
                requests={requests}
                loading={loadingRequests}
                onAccept={handleAccept}
                onReject={handleReject}
                emptyMessage="No pending friend requests."
              />
            )}

            {tab === "search" && (
              <div style={{ display: "grid", gap: "16px" }}>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by username"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #d1d5db",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    fontSize: "15px",
                  }}
                />

                {trimmedSearch ? (
                  loadingSearch ? (
                    <p style={{ color: "#6b7280" }}>Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p style={{ color: "#6b7280" }}>No users found.</p>
                  ) : (
                    <div style={{ display: "grid", gap: "12px" }}>
                      {searchResults.map((user) => {
                        const busy = isBusy(user.id);

                        return (
                          <div
                            key={user.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "12px",
                              padding: "14px 16px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "16px",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700 }}>
                                {user.username}
                              </div>
                              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                                {user.email}
                              </div>
                              <div
                                style={{
                                  marginTop: "4px",
                                  fontSize: "12px",
                                  color: onlineUserIds.includes(user.id)
                                    ? "#16a34a"
                                    : "#6b7280",
                                  fontWeight: 600,
                                }}
                              >
                                {onlineUserIds.includes(user.id)
                                  ? "🟢 Online"
                                  : "⚫ Offline"}
                              </div>
                              <div
                                style={{
                                  marginTop: "6px",
                                  fontSize: "12px",
                                  color: "#2563eb",
                                  fontWeight: 600,
                                }}
                              >
                                {statusLabel[user.relationship]}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              {user.relationship === "SELF" && (
                                <span
                                  style={{
                                    borderRadius: "999px",
                                    background: "#f3f4f6",
                                    padding: "8px 12px",
                                    fontSize: "13px",
                                  }}
                                >
                                  You
                                </span>
                              )}

                              {user.relationship === "NOT_FRIENDS" && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleAddFriend(user.id)}
                                  style={{
                                    border: "none",
                                    borderRadius: "8px",
                                    background: busy ? "#93c5fd" : "#2563eb",
                                    color: "white",
                                    padding: "8px 12px",
                                    cursor: busy ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {busy ? "Sending..." : "Add Friend"}
                                </button>
                              )}

                              {user.relationship === "REQUEST_SENT" && (
                                <button
                                  type="button"
                                  disabled
                                  style={{
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    background: "#f9fafb",
                                    color: "#6b7280",
                                    padding: "8px 12px",
                                  }}
                                >
                                  Request Sent
                                </button>
                              )}

                              {user.relationship === "REQUEST_RECEIVED" && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                      if (!user.friendRequestId) return;
                                      await handleAccept({
                                        id: user.friendRequestId,
                                        senderId: user.id,
                                        receiverId: currentUser?.id ?? "",
                                        createdAt: "",
                                        sender: {
                                          id: user.id,
                                          username: user.username,
                                          email: user.email,
                                        },
                                        receiver: {
                                          id: currentUser?.id ?? "",
                                          username: currentUser?.username ?? "",
                                          email: currentUser?.email ?? "",
                                        },
                                      });
                                    }}
                                    style={{
                                      border: "none",
                                      borderRadius: "8px",
                                      background: busy ? "#86efac" : "#16a34a",
                                      color: "white",
                                      padding: "8px 12px",
                                      cursor: busy ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {busy ? "Accepting..." : "Accept"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                      if (!user.friendRequestId) return;
                                      await handleReject({
                                        id: user.friendRequestId,
                                        senderId: user.id,
                                        receiverId: currentUser?.id ?? "",
                                        createdAt: "",
                                        sender: {
                                          id: user.id,
                                          username: user.username,
                                          email: user.email,
                                        },
                                        receiver: {
                                          id: currentUser?.id ?? "",
                                          username: currentUser?.username ?? "",
                                          email: currentUser?.email ?? "",
                                        },
                                      });
                                    }}
                                    style={{
                                      border: "1px solid #d1d5db",
                                      borderRadius: "8px",
                                      background: "white",
                                      color: "#111827",
                                      padding: "8px 12px",
                                      cursor: busy ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {busy ? "Rejecting..." : "Reject"}
                                  </button>
                                </>
                              )}

                              {user.relationship === "FRIENDS" && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      openConversation({
                                        id: user.id,
                                        username: user.username,
                                        email: user.email,
                                      })
                                    }
                                    style={{
                                      border: "none",
                                      borderRadius: "8px",
                                      background: busy ? "#93c5fd" : "#2563eb",
                                      color: "white",
                                      padding: "8px 12px",
                                      cursor: busy ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    Message
                                  </button>

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      handleRemoveFriend({
                                        id: user.id,
                                        username: user.username,
                                        email: user.email,
                                      })
                                    }
                                    style={{
                                      border: "1px solid #d1d5db",
                                      borderRadius: "8px",
                                      background: "white",
                                      color: "#111827",
                                      padding: "8px 12px",
                                      cursor: busy ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {busy ? "Removing..." : "Remove Friend"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <p style={{ color: "#6b7280" }}>
                    Search for someone to add them as a friend.
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
