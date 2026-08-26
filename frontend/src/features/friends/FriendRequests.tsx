import type { FriendRequest } from "../../services/api";

type FriendRequestsProps = {
  requests: FriendRequest[];

  onAccept: (request: FriendRequest) => void;
  onReject: (request: FriendRequest) => void;

  loading?: boolean;
  isDark?: boolean;

  emptyMessage?: string;
};

export default function FriendRequests({
  requests,
  onAccept,
  onReject,

  loading = false,
  isDark = true,

  emptyMessage = "No pending friend requests.",
}: FriendRequestsProps) {
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

        Loading requests...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div
        className={`flex min-h-[300px] flex-col items-center justify-center rounded-2xl border px-6 text-center ${
          isDark
            ? "border-white/[0.06] bg-white/[0.015]"
            : "border-black/[0.06] bg-black/[0.015]"
        }`}
      >
        <div
          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl ${
            isDark
              ? "bg-white/[0.05]"
              : "bg-black/[0.04]"
          }`}
        >
          ✉️
        </div>

        <h3 className="text-sm font-semibold">
          {emptyMessage}
        </h3>

        <p
          className={`mt-2 max-w-xs text-xs leading-5 ${
            isDark
              ? "text-white/40"
              : "text-black/40"
          }`}
        >
          New friend requests will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const sender = request.sender;

        return (
          <div
            key={request.id}
            className={`flex flex-col gap-4 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
              isDark
                ? "border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.045]"
                : "border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.035]"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              {/* AVATAR */}

              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDark
                    ? "bg-white/[0.08] text-white"
                    : "bg-black/[0.05] text-black"
                }`}
              >
                {sender.username
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              {/* USER INFO */}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {sender.username}
                </p>

                <p
                  className={`mt-0.5 truncate text-xs ${
                    isDark
                      ? "text-white/40"
                      : "text-black/40"
                  }`}
                >
                  {sender.email}
                </p>

                <p
                  className={`mt-1 text-[10px] ${
                    isDark
                      ? "text-white/30"
                      : "text-black/35"
                  }`}
                >
                  Wants to connect with you
                </p>
              </div>
            </div>

            {/* ACTIONS */}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAccept(request)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-600 active:scale-[0.97]"
              >
                Accept
              </button>

              <button
                type="button"
                onClick={() => onReject(request)}
                className={`rounded-lg border px-4 py-2 text-xs font-medium transition-all active:scale-[0.97] ${
                  isDark
                    ? "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
                    : "border-black/[0.08] bg-black/[0.02] text-black/70 hover:bg-black/[0.05]"
                }`}
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}