import { useNavigate } from "react-router-dom";

type Theme = "dark" | "light";

type ChatHeaderProps = {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  friendRequestCount: number;
};

export default function ChatHeader({
  theme,
  setTheme,
  friendRequestCount,
}: ChatHeaderProps) {
  const navigate = useNavigate();

  const isDark = theme === "dark";

  return (
    <header
      className="
        flex
        h-16
        shrink-0
        items-center
        justify-between
        border-b
        border-slate-200
        bg-white
        px-4
        sm:px-6
        dark:border-slate-800
        dark:bg-slate-950
      "
    >
      {/* BRAND */}

      <div className="flex min-w-0 items-center gap-3">
        {/* LOGO */}

        <div
          className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-slate-900
            text-xs
            font-bold
            tracking-tight
            text-white
            shadow-sm
            dark:bg-white
            dark:text-slate-900
          "
        >
          RT
        </div>

        {/* TITLE */}

        <div className="min-w-0">
          <h1
            className="
              truncate
              text-sm
              font-semibold
              text-slate-900
              sm:text-base
              dark:text-white
            "
          >
            Real-Time Chat
          </h1>

          <p
            className="
              hidden
              text-[11px]
              text-slate-500
              sm:block
              dark:text-slate-500
            "
          >
            Connected conversations
          </p>
        </div>
      </div>

      {/* ACTIONS */}

      <div className="flex items-center gap-2">
        {/* FRIENDS */}

        <button
          type="button"
          onClick={() => navigate("/friends")}
          aria-label="Friends"
          title="Friends"
          className="
            relative
            flex
            h-9
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-slate-200
            bg-white
            px-3
            text-sm
            font-medium
            text-slate-700
            transition
            hover:bg-slate-50
            active:scale-[0.98]
            dark:border-slate-800
            dark:bg-slate-950
            dark:text-slate-300
            dark:hover:bg-slate-900
          "
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <path d="M18 8v6" />
            <path d="M21 11h-6" />
          </svg>

          <span className="hidden sm:inline">Friends</span>

          {friendRequestCount > 0 && (
            <span
              className="
                flex
                h-4
                min-w-4
                items-center
                justify-center
                rounded-full
                bg-red-500
                px-1
                text-[9px]
                font-bold
                text-white
              "
            >
              {friendRequestCount > 99 ? "99+" : friendRequestCount}
            </span>
          )}
        </button>

        {/* THEME */}

        <button
          type="button"
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          title={`Switch to ${isDark ? "light" : "dark"} mode`}
          onClick={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
          className="
            flex
            h-9
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-slate-200
            bg-white
            px-3
            text-sm
            font-medium
            text-slate-700
            transition
            hover:bg-slate-50
            active:scale-[0.98]
            dark:border-slate-800
            dark:bg-slate-950
            dark:text-slate-300
            dark:hover:bg-slate-900
          "
        >
          <span className="flex h-4 w-4 items-center justify-center text-base leading-none">
            {isDark ? "☀" : "☾"}
          </span>

          <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </header>
  );
}
