import type { Friend } from "../../services/api";
import { usePresenceStore } from "../presence/presenceStore";

type FriendListProps = {
  friends: Friend[];
  onMessage: (friend: Friend) => void;
  onRemove: (friend: Friend) => void;

  loading?: boolean;
  isDark?: boolean;

  emptyTitle?: string;
  emptySubtitle?: string;
};

export default function FriendList({
  friends,
  onMessage,
  onRemove,
  loading = false,
  isDark = true,
  emptyTitle = "No friends yet.",
  emptySubtitle,
}: FriendListProps) {
  const onlineUserIds = usePresenceStore(
    (state) => state.onlineUserIds,
  );

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <div
        className={`flex items-center gap-3 py-8 text-sm ${
          isDark
            ? "text-white/40"
            : "text-black/40"
        }`}
      >
        <span
          className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${
            isDark
              ? "border-white/25"
              : "border-black/25"
          }`}
        />

        Loading friends...
      </div>
    );
  }

  /* =========================================================
     EMPTY STATE
     ========================================================= */

  if (friends.length === 0) {
    return (
      <div
        className={`flex min-h-[280px] w-full flex-col items-center justify-center rounded-2xl border px-6 text-center ${
          isDark
            ? "border-white/[0.06] bg-white/[0.012]"
            : "border-black/[0.06] bg-black/[0.012]"
        }`}
      >
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-lg ${
            isDark
              ? "bg-white/[0.05]"
              : "bg-black/[0.04]"
          }`}
        >
          👥
        </div>

        <h3 className="text-sm font-semibold">
          {emptyTitle}
        </h3>

        {emptySubtitle && (
          <p
            className={`mt-2 max-w-xs text-xs leading-5 ${
              isDark
                ? "text-white/35"
                : "text-black/40"
            }`}
          >
            {emptySubtitle}
          </p>
        )}
      </div>
    );
  }

  /* =========================================================
     FRIEND GRID
     ========================================================= */

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
      {friends.map((friend) => {
        const isOnline =
          onlineUserIds.includes(friend.id);

        return (
          <div
            key={friend.id}
            className={`min-w-0 overflow-hidden rounded-xl border p-4 transition ${
              isDark
                ? "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.035]"
                : "border-black/[0.06] bg-black/[0.015] hover:border-black/[0.10] hover:bg-black/[0.025]"
            }`}
          >
            {/* =================================================
               USER INFO
               ================================================= */}

            <div className="flex min-w-0 items-center gap-3">
              {/* AVATAR */}

              <div className="relative shrink-0">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-xs font-semibold ${
                    isDark
                      ? "bg-white/[0.08] text-white"
                      : "bg-black/[0.05] text-black"
                  }`}
                >
                  {friend.username
                    .slice(0, 2)
                    .toUpperCase()}
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

              {/* USER DETAILS */}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {friend.username}
                </p>

                <p
                  className={`mt-0.5 truncate text-xs ${
                    isDark
                      ? "text-white/40"
                      : "text-black/40"
                  }`}
                >
                  {friend.email}
                </p>

                <p
                  className={`mt-1 text-[10px] font-medium ${
                    isOnline
                      ? "text-emerald-500"
                      : isDark
                        ? "text-white/30"
                        : "text-black/35"
                  }`}
                >
                  {isOnline
                    ? "Online"
                    : "Offline"}
                </p>
              </div>
            </div>

            {/* =================================================
               DIVIDER
               ================================================= */}

            <div
              className={`my-4 h-px ${
                isDark
                  ? "bg-white/[0.06]"
                  : "bg-black/[0.06]"
              }`}
            />

            {/* =================================================
               ACTIONS
               ================================================= */}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onMessage(friend)
                }
                className={`min-w-0 rounded-lg px-3 py-2.5 text-xs font-semibold transition active:scale-[0.97] ${
                  isDark
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-black text-white hover:bg-black/85"
                }`}
              >
                Message
              </button>

              <button
                type="button"
                onClick={() =>
                  onRemove(friend)
                }
                className={`min-w-0 rounded-lg border px-3 py-2.5 text-xs font-medium transition active:scale-[0.97] ${
                  isDark
                    ? "border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.07] hover:text-white"
                    : "border-black/[0.08] bg-black/[0.02] text-black/65 hover:bg-black/[0.05] hover:text-black"
                }`}
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}