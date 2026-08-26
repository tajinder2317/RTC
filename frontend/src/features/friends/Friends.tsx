import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../auth/authStore";
import { useChatStore } from "../chat/chatStore";
import { usePresenceStore } from "../presence/presenceStore";

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

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return localStorage.getItem("rtc-theme") === "light" ? "light" : "dark";
  });

  const searchRequestIdRef = useRef(0);

  const pendingCount = requests.length;

  const trimmedSearch = searchInput.trim();

  const isDark = theme === "dark";

  /* =========================================================
     THEME
     ========================================================= */

  useEffect(() => {
    localStorage.setItem("rtc-theme", theme);
  }, [theme]);

  /* =========================================================
     NOTICE
     ========================================================= */

  const showNotice = (kind: NoticeKind, message: string) => {
    setNotice({
      kind,
      message,
    });
  };

  /* =========================================================
     SEARCH
     ========================================================= */

  const executeSearch = async (
    query: string,
    requestId: number,
    showLoading: boolean,
  ) => {
    if (!token) return;

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

  /* =========================================================
     REFRESH FRIENDS
     ========================================================= */

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

  /* =========================================================
     REFRESH REQUESTS
     ========================================================= */

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

  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  useEffect(() => {
    if (!token) {
      setLoadingFriends(false);
      setLoadingRequests(false);

      return;
    }

    void refreshFriends();
    void refreshRequests();
  }, [token]);

  /* =========================================================
     SEARCH DEBOUNCE
     ========================================================= */

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

  /* =========================================================
     REALTIME FRIEND EVENTS
     ========================================================= */

  useEffect(() => {
    const unsubscribe = subscribeToFriendEvents({
      onNewRequest: () => {
        void refreshRequests();

        if (trimmedSearch) {
          void executeSearch(
            trimmedSearch,
            ++searchRequestIdRef.current,
            false,
          );
        }
      },

      onAccepted: () => {
        void refreshFriends();
        void refreshRequests();

        if (trimmedSearch) {
          void executeSearch(
            trimmedSearch,
            ++searchRequestIdRef.current,
            false,
          );
        }
      },
    });

    return unsubscribe;
  }, [token, trimmedSearch]);

  /* =========================================================
     OPEN CONVERSATION
     ========================================================= */

  const openConversation = async (friend: UserCard) => {
    if (!token) return;

    try {
      setActiveAction({
        type: "send",
        id: friend.id,
      });

      const conversation = await createConversation(token, friend.id);

      setConversation(conversation);

      navigate("/chat");
    } catch (error) {
      console.error("Open conversation error:", error);

      showNotice("error", "Failed to open chat");
    } finally {
      setActiveAction({
        type: null,
        id: null,
      });
    }
  };

  /* =========================================================
     ADD FRIEND
     ========================================================= */

  const handleAddFriend = async (userId: string) => {
    if (!token) return;

    try {
      setActiveAction({
        type: "send",
        id: userId,
      });

      const data = await sendFriendRequest(token, userId);

      showNotice("success", data.message || "Friend request sent");

      await refreshRequests();

      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Send friend request error:", error);

      showNotice(
        "error",
        error instanceof Error
          ? error.message
          : "Failed to send friend request",
      );
    } finally {
      setActiveAction({
        type: null,
        id: null,
      });
    }
  };

  /* =========================================================
     ACCEPT REQUEST
     ========================================================= */

  const handleAccept = async (request: FriendRequest) => {
    if (!token) return;

    try {
      setActiveAction({
        type: "accept",
        id: request.id,
      });

      const data = await acceptFriendRequest(token, request.id);

      showNotice("success", data.message || "Friend request accepted");

      await refreshFriends();
      await refreshRequests();

      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Accept friend request error:", error);

      showNotice(
        "error",
        error instanceof Error ? error.message : "Failed to accept request",
      );
    } finally {
      setActiveAction({
        type: null,
        id: null,
      });
    }
  };

  /* =========================================================
     REJECT REQUEST
     ========================================================= */

  const handleReject = async (request: FriendRequest) => {
    if (!token) return;

    try {
      setActiveAction({
        type: "reject",
        id: request.id,
      });

      const data = await rejectFriendRequest(token, request.id);

      showNotice("success", data.message || "Friend request rejected");

      await refreshRequests();

      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Reject friend request error:", error);

      showNotice(
        "error",
        error instanceof Error ? error.message : "Failed to reject request",
      );
    } finally {
      setActiveAction({
        type: null,
        id: null,
      });
    }
  };

  /* =========================================================
     REMOVE FRIEND
     ========================================================= */

  const handleRemoveFriend = async (friend: Friend) => {
    if (!token) return;

    try {
      setActiveAction({
        type: "remove",
        id: friend.id,
      });

      const data = await removeFriend(token, friend.id);

      showNotice("success", data.message || "Friend removed");

      await refreshFriends();

      if (trimmedSearch) {
        void executeSearch(trimmedSearch, ++searchRequestIdRef.current, false);
      }
    } catch (error) {
      console.error("Remove friend error:", error);

      showNotice(
        "error",
        error instanceof Error ? error.message : "Failed to remove friend",
      );
    } finally {
      setActiveAction({
        type: null,
        id: null,
      });
    }
  };

  /* =========================================================
     BUSY STATE
     ========================================================= */

  const isBusy = (id: string) => {
    return activeAction.id === id && activeAction.type !== null;
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div
      className={`min-h-[100dvh] w-full transition-colors duration-200 ${
        isDark ? "bg-[#070707] text-white" : "bg-[#f5f7fa] text-[#111827]"
      }`}
    >
      {/* =====================================================
          HEADER
          ===================================================== */}

      <header
        className={`fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b px-4 sm:px-6 lg:px-8 ${
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
              Friends
            </h1>

            <p
              className={`hidden text-[11px] sm:block ${
                isDark ? "text-white/40" : "text-black/40"
              }`}
            >
              Manage your connections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* BACK TO CHAT */}

          <button
            type="button"
            onClick={() => navigate("/chat")}
            aria-label="Back to Chat"
            title="Back to Chat"
            className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all active:scale-[0.98] ${
              isDark
                ? "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                : "border-black/[0.08] bg-black/[0.02] text-black/65 hover:bg-black/[0.05] hover:text-black"
            }`}
          >
            <span className="text-sm">←</span>

            <span className="hidden sm:inline">Back to Chat</span>
          </button>

          {/* THEME */}

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

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="w-full pt-16">
        <div
          className={`w-full p-0 sm:p-4 lg:p-5 ${
            isDark ? "sm:bg-[#070707]" : "sm:bg-[#f5f7fa]"
          }`}
        >
          {/* =================================================
              MAIN APP CONTAINER

              IMPORTANT:
              overflow-visible keeps tab content from being
              clipped. The page handles vertical scrolling.
              ================================================= */}

          <div
            className={`mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-[1600px] flex-col overflow-visible sm:rounded-2xl sm:border sm:shadow-2xl md:flex-row ${
              isDark
                ? "bg-[#101010] sm:border-white/[0.08]"
                : "bg-white sm:border-black/[0.08]"
            }`}
          >
            {/* =================================================
                SIDEBAR
                ================================================= */}

            <aside
              className={`w-full shrink-0 border-b p-4 md:w-[260px] md:border-b-0 md:border-r md:p-5 lg:w-[280px] ${
                isDark ? "border-white/[0.08]" : "border-black/[0.08]"
              }`}
            >
              <div className="mb-6">
                <h2 className="text-sm font-semibold">Connections</h2>

                <p
                  className={`mt-1 text-[11px] ${
                    isDark ? "text-white/40" : "text-black/40"
                  }`}
                >
                  Manage your network
                </p>
              </div>

              {/* TABS */}

              <div className="flex gap-2 overflow-x-auto md:grid md:gap-2">
                {(
                  [
                    ["friends", "My Friends", friends.length],
                    ["requests", "Requests", pendingCount],
                    ["search", "Search Users", undefined],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex min-h-[46px] shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-xs font-medium transition-all duration-200 active:scale-[0.99] md:w-full ${
                      tab === key
                        ? isDark
                          ? "border-white/[0.12] bg-white/[0.08] text-white shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
                          : "border-black/[0.10] bg-black/[0.04] text-black shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                        : isDark
                          ? "border-white/[0.06] bg-transparent text-white/55 hover:border-white/[0.09] hover:bg-white/[0.035] hover:text-white"
                          : "border-black/[0.06] bg-transparent text-black/55 hover:border-black/[0.09] hover:bg-black/[0.025] hover:text-black"
                    }`}
                  >
                    <span className="whitespace-nowrap">{label}</span>

                    {typeof count === "number" && count > 0 && (
                      <span
                        className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          tab === key
                            ? isDark
                              ? "bg-white text-black"
                              : "bg-black text-white"
                            : isDark
                              ? "bg-white/[0.10] text-white/70"
                              : "bg-black/[0.07] text-black/60"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </aside>

            {/* =================================================
                CONTENT

                IMPORTANT:
                No h-full and no overflow-y-auto here.
                This allows every tab to determine its own
                height naturally.
                ================================================= */}

            <section className="min-w-0 flex-1">
              <div className="w-full min-w-0">
                <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
                  {/* CONTENT HEADER */}

                  <div className="mb-6">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {tab === "friends" && "My Friends"}

                      {tab === "requests" && "Friend Requests"}

                      {tab === "search" && "Find People"}
                    </h2>

                    <p
                      className={`mt-1 text-sm ${
                        isDark ? "text-white/40" : "text-black/40"
                      }`}
                    >
                      {tab === "friends" && "People you are connected with."}

                      {tab === "requests" &&
                        "Review your pending friend requests."}

                      {tab === "search" &&
                        "Search for new people to connect with."}
                    </p>
                  </div>

                  {/* NOTICE */}

                  {notice && (
                    <div
                      className={`mb-5 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
                        notice.kind === "error"
                          ? isDark
                            ? "border-red-400/20 bg-red-400/[0.08] text-red-300"
                            : "border-red-500/20 bg-red-50 text-red-700"
                          : isDark
                            ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
                            : "border-emerald-500/20 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <span>{notice.message}</span>

                      <button
                        type="button"
                        onClick={() => setNotice(null)}
                        className="text-lg opacity-60 transition hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* =================================================
                      FRIENDS
                      ================================================= */}

                  {tab === "friends" && (
                    <FriendList
                      friends={friends}
                      loading={loadingFriends}
                      onMessage={openConversation}
                      onRemove={handleRemoveFriend}
                      isDark={isDark}
                      emptyTitle="No friends yet."
                      emptySubtitle="Search for someone to add them as a friend."
                    />
                  )}

                  {/* =================================================
                      REQUESTS
                      ================================================= */}

                  {tab === "requests" && (
                    <FriendRequests
                      requests={requests}
                      loading={loadingRequests}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      isDark={isDark}
                      emptyMessage="No pending friend requests."
                    />
                  )}

                  {/* =================================================
                      SEARCH
                      ================================================= */}

                  {tab === "search" && (
                    <div className="w-full space-y-5">
                      {/* SEARCH INPUT */}

                      <div className="relative w-full">
                        <svg
                          className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${
                            isDark ? "text-white/35" : "text-black/35"
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="7" />

                          <path d="m20 20-3.5-3.5" />
                        </svg>

                        <input
                          type="text"
                          value={searchInput}
                          onChange={(event) =>
                            setSearchInput(event.target.value)
                          }
                          placeholder="Search by username"
                          className={`w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition ${
                            isDark
                              ? "border-white/[0.08] bg-white/[0.03] text-white placeholder:text-white/30 focus:border-white/[0.18] focus:bg-white/[0.05]"
                              : "border-black/[0.08] bg-black/[0.02] text-black placeholder:text-black/35 focus:border-black/[0.16] focus:bg-black/[0.03]"
                          }`}
                        />
                      </div>

                      {/* EMPTY SEARCH */}

                      {!trimmedSearch ? (
                        <div
                          className={`flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border text-center ${
                            isDark
                              ? "border-white/[0.06] bg-white/[0.015]"
                              : "border-black/[0.06] bg-black/[0.015]"
                          }`}
                        >
                          <div
                            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl ${
                              isDark ? "bg-white/[0.05]" : "bg-black/[0.04]"
                            }`}
                          >
                            🔎
                          </div>

                          <h3 className="text-sm font-semibold">
                            Find new people
                          </h3>

                          <p
                            className={`mt-2 max-w-xs text-xs leading-5 ${
                              isDark ? "text-white/40" : "text-black/40"
                            }`}
                          >
                            Search by username to find and connect with other
                            users.
                          </p>
                        </div>
                      ) : loadingSearch ? (
                        <div
                          className={`flex items-center gap-3 py-8 text-sm ${
                            isDark ? "text-white/40" : "text-black/40"
                          }`}
                        >
                          <span
                            className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
                              isDark ? "border-white/25" : "border-black/25"
                            }`}
                          />
                          Searching users...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div
                          className={`rounded-2xl border p-8 text-center text-sm ${
                            isDark
                              ? "border-white/[0.06] bg-white/[0.015] text-white/40"
                              : "border-black/[0.06] bg-black/[0.015] text-black/40"
                          }`}
                        >
                          No users found.
                        </div>
                      ) : (
                        /* SEARCH RESULTS */

                        <div
                          className="
                            grid
                            w-full
                            min-w-0
                            grid-cols-1
                            gap-3
                            lg:grid-cols-2
                            2xl:grid-cols-3
                          "
                        >
                          {searchResults.map((user) => {
                            const busy = isBusy(user.id);

                            const isOnline = onlineUserIds.includes(user.id);

                            return (
                              <div
                                key={user.id}
                                className={`min-w-0 overflow-hidden rounded-2xl border p-4 transition-all ${
                                  isDark
                                    ? "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.10] hover:bg-white/[0.045]"
                                    : "border-black/[0.06] bg-black/[0.018] hover:border-black/[0.10] hover:bg-black/[0.035]"
                                }`}
                              >
                                {/* USER */}

                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="relative shrink-0">
                                    <div
                                      className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ${
                                        isDark
                                          ? "bg-white/[0.08] text-white"
                                          : "bg-black/[0.05] text-black"
                                      }`}
                                    >
                                      {user.username.slice(0, 2).toUpperCase()}
                                    </div>

                                    <span
                                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${
                                        isDark
                                          ? "border-[#101010]"
                                          : "border-white"
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
                                    <p className="truncate text-sm font-semibold">
                                      {user.username}
                                    </p>

                                    <p
                                      className={`mt-0.5 truncate text-xs ${
                                        isDark
                                          ? "text-white/40"
                                          : "text-black/40"
                                      }`}
                                    >
                                      {user.email}
                                    </p>

                                    <p
                                      className={`mt-1 text-[10px] font-medium ${
                                        isOnline
                                          ? "text-emerald-500"
                                          : isDark
                                            ? "text-white/35"
                                            : "text-black/35"
                                      }`}
                                    >
                                      {isOnline ? "Online" : "Offline"}
                                    </p>
                                  </div>
                                </div>

                                {/* DIVIDER */}

                                <div
                                  className={`my-4 h-px ${
                                    isDark
                                      ? "bg-white/[0.06]"
                                      : "bg-black/[0.06]"
                                  }`}
                                />

                                {/* ACTIONS */}

                                <div className="flex flex-wrap gap-2">
                                  {user.relationship === "SELF" && (
                                    <span
                                      className={`rounded-lg px-3 py-2 text-xs ${
                                        isDark
                                          ? "bg-white/[0.06] text-white/45"
                                          : "bg-black/[0.04] text-black/45"
                                      }`}
                                    >
                                      {statusLabel.SELF}
                                    </span>
                                  )}

                                  {user.relationship === "NOT_FRIENDS" && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => handleAddFriend(user.id)}
                                      className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                                        isDark
                                          ? "bg-white text-black hover:bg-white/90"
                                          : "bg-black text-white hover:bg-black/85"
                                      }`}
                                    >
                                      {busy ? "Sending..." : "Add Friend"}
                                    </button>
                                  )}

                                  {user.relationship === "REQUEST_SENT" && (
                                    <span
                                      className={`flex-1 rounded-lg border px-4 py-2.5 text-center text-xs font-medium ${
                                        isDark
                                          ? "border-white/[0.08] bg-white/[0.04] text-white/45"
                                          : "border-black/[0.08] bg-black/[0.03] text-black/45"
                                      }`}
                                    >
                                      Request Sent
                                    </span>
                                  )}

                                  {user.relationship === "REQUEST_RECEIVED" && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                          if (!user.friendRequestId) {
                                            return;
                                          }

                                          void handleAccept({
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
                                              username:
                                                currentUser?.username ?? "",
                                              email: currentUser?.email ?? "",
                                            },
                                          });
                                        }}
                                        className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-emerald-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {busy ? "Accepting..." : "Accept"}
                                      </button>

                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                          if (!user.friendRequestId) {
                                            return;
                                          }

                                          void handleReject({
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
                                              username:
                                                currentUser?.username ?? "",
                                              email: currentUser?.email ?? "",
                                            },
                                          });
                                        }}
                                        className={`flex-1 rounded-lg border px-4 py-2.5 text-xs font-medium transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                                          isDark
                                            ? "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
                                            : "border-black/[0.08] bg-black/[0.02] text-black/70 hover:bg-black/[0.05]"
                                        }`}
                                      >
                                        Reject
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
                                        className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                                          isDark
                                            ? "bg-white text-black hover:bg-white/90"
                                            : "bg-black text-white hover:bg-black/85"
                                        }`}
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
                                        className={`flex-1 rounded-lg border px-4 py-2.5 text-xs font-medium transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                                          isDark
                                            ? "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
                                            : "border-black/[0.08] bg-black/[0.02] text-black/70 hover:bg-black/[0.05]"
                                        }`}
                                      >
                                        {busy ? "Removing..." : "Remove"}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
