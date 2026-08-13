import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser, loginUser } from "../../services/api";
import { useAuthStore } from "./authStore";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark",
  );

  localStorage.setItem("rtc-theme", theme);
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("rtc-theme");

  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return "dark";
}

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "dark" ? "light" : "dark",
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const data = await registerUser(
        username,
        email,
        password,
      );

      if (data?.token && data?.user) {
        login(data.token, data.user);
      } else {
        const loginData = await loginUser(
          email,
          password,
        );

        login(loginData.token, loginData.user);
      }

      navigate("/chat", { replace: true });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === "dark";

  return (
    <main
      className="
        min-h-dvh
        bg-zinc-100
        text-zinc-950
        transition-colors duration-300
        dark:bg-[#050505]
        dark:text-white
      "
    >
      <div
        className="
          relative flex min-h-dvh
          items-center justify-center
          overflow-hidden
          p-3 sm:p-5 lg:p-8
        "
      >
        {/* Background */}
        <div
          className="
            pointer-events-none absolute inset-0
            bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.06),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.05),transparent_35%)]
            dark:bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.055),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.035),transparent_35%)]
          "
        />

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="
            absolute right-4 top-4 z-20
            flex h-10 w-10
            items-center justify-center
            rounded-xl
            border border-black/10
            bg-white/70
            text-zinc-700
            shadow-sm
            backdrop-blur-xl
            transition
            hover:bg-white
            dark:border-white/10
            dark:bg-white/[0.06]
            dark:text-white/80
            dark:hover:bg-white/[0.1]
            sm:right-6 sm:top-6
          "
        >
          {isDark ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
            >
              <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />
            </svg>
          )}
        </button>

        {/* Main card */}
        <div
          className="
            relative z-10
            flex w-full max-w-5xl
            overflow-hidden
            rounded-[24px]
            border
            border-black/[0.08]
            bg-white/70
            shadow-[0_30px_100px_rgba(0,0,0,0.12)]
            backdrop-blur-2xl
            dark:border-white/[0.09]
            dark:bg-white/[0.035]
            dark:shadow-[0_30px_100px_rgba(0,0,0,0.45)]
            lg:min-h-[620px]
          "
        >
          {/* Brand panel */}
          <section
            className="
              relative hidden
              w-[45%]
              overflow-hidden
              border-r
              border-black/[0.07]
              bg-zinc-950
              p-10
              text-white
              dark:border-white/[0.08]
              lg:flex
              lg:flex-col
              lg:justify-between
            "
          >
            <div
              className="
                pointer-events-none absolute inset-0
                bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.07),transparent_35%)]
              "
            />

            <div className="relative">
              <div
                className="
                  flex h-11 w-11
                  items-center justify-center
                  rounded-[14px]
                  border border-white/15
                  bg-white/[0.07]
                  text-xs font-black
                  shadow-lg
                "
              >
                RTC
              </div>
            </div>

            <div className="relative">
              <p className="mb-4 text-[10px] font-bold tracking-[0.2em] text-white/40">
                REAL-TIME CHAT
              </p>

              <h2
                className="
                  text-5xl font-bold
                  leading-[0.95]
                  tracking-[-0.045em]
                "
              >
                Meet.
                <br />
                Message.
                <br />
                Connect.
              </h2>

              <p
                className="
                  mt-6 max-w-sm
                  text-sm leading-6
                  text-white/45
                "
              >
                Create your account and start having
                real-time conversations with your friends.
              </p>
            </div>

            <div className="relative flex gap-2">
              <span className="h-1 w-10 rounded-full bg-white/70" />
              <span className="h-1 w-5 rounded-full bg-white/20" />
              <span className="h-1 w-2 rounded-full bg-white/10" />
            </div>
          </section>

          {/* Register panel */}
          <section
            className="
              flex min-w-0 flex-1
              items-center justify-center
              p-6 sm:p-10 lg:p-14
            "
          >
            <div className="w-full max-w-md">
              {/* Mobile brand */}
              <div
                className="
                  mb-7 flex items-center gap-3
                  lg:hidden
                "
              >
                <div
                  className="
                    flex h-10 w-10
                    items-center justify-center
                    rounded-xl
                    bg-zinc-950
                    text-[10px] font-black
                    text-white
                    dark:bg-white
                    dark:text-black
                  "
                >
                  RTC
                </div>

                <span
                  className="
                    text-xs font-bold
                    tracking-[0.15em]
                    opacity-50
                  "
                >
                  REAL-TIME CHAT
                </span>
              </div>

              {/* Heading */}
              <div className="mb-7">
                <p
                  className="
                    mb-2
                    text-[10px] font-bold
                    tracking-[0.18em]
                    text-zinc-500
                    dark:text-white/35
                  "
                >
                  GET STARTED
                </p>

                <h1
                  className="
                    text-3xl font-bold
                    tracking-[-0.035em]
                    sm:text-4xl
                  "
                >
                  Create your account
                </h1>

                <p
                  className="
                    mt-2
                    text-sm
                    text-zinc-500
                    dark:text-white/40
                  "
                >
                  It only takes a moment to get started.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* Username */}
                <div className="space-y-2">
                  <label
                    htmlFor="register-username"
                    className="
                      text-xs font-semibold
                      text-zinc-700
                      dark:text-white/65
                    "
                  >
                    Username
                  </label>

                  <input
                    id="register-username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value)
                    }
                    autoComplete="username"
                    required
                    className="
                      h-12 w-full
                      rounded-xl
                      border border-black/[0.09]
                      bg-black/[0.025]
                      px-4
                      text-sm text-zinc-900
                      outline-none
                      transition
                      placeholder:text-zinc-400
                      focus:border-black/20
                      focus:bg-white
                      focus:ring-4
                      focus:ring-black/[0.035]
                      dark:border-white/[0.09]
                      dark:bg-white/[0.035]
                      dark:text-white
                      dark:placeholder:text-white/25
                      dark:focus:border-white/20
                      dark:focus:bg-white/[0.055]
                      dark:focus:ring-white/[0.04]
                    "
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label
                    htmlFor="register-email"
                    className="
                      text-xs font-semibold
                      text-zinc-700
                      dark:text-white/65
                    "
                  >
                    Email
                  </label>

                  <input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    autoComplete="email"
                    required
                    className="
                      h-12 w-full
                      rounded-xl
                      border border-black/[0.09]
                      bg-black/[0.025]
                      px-4
                      text-sm text-zinc-900
                      outline-none
                      transition
                      placeholder:text-zinc-400
                      focus:border-black/20
                      focus:bg-white
                      focus:ring-4
                      focus:ring-black/[0.035]
                      dark:border-white/[0.09]
                      dark:bg-white/[0.035]
                      dark:text-white
                      dark:placeholder:text-white/25
                      dark:focus:border-white/20
                      dark:focus:bg-white/[0.055]
                      dark:focus:ring-white/[0.04]
                    "
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label
                    htmlFor="register-password"
                    className="
                      text-xs font-semibold
                      text-zinc-700
                      dark:text-white/65
                    "
                  >
                    Password
                  </label>

                  <div className="relative">
                    <input
                      id="register-password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      autoComplete="new-password"
                      required
                      className="
                        h-12 w-full
                        rounded-xl
                        border border-black/[0.09]
                        bg-black/[0.025]
                        px-4 pr-16
                        text-sm text-zinc-900
                        outline-none
                        transition
                        placeholder:text-zinc-400
                        focus:border-black/20
                        focus:bg-white
                        focus:ring-4
                        focus:ring-black/[0.035]
                        dark:border-white/[0.09]
                        dark:bg-white/[0.035]
                        dark:text-white
                        dark:placeholder:text-white/25
                        dark:focus:border-white/20
                        dark:focus:bg-white/[0.055]
                        dark:focus:ring-white/[0.04]
                      "
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (value) => !value,
                        )
                      }
                      className="
                        absolute right-3 top-1/2
                        -translate-y-1/2
                        text-[11px] font-semibold
                        text-zinc-400
                        transition
                        hover:text-zinc-700
                        dark:text-white/35
                        dark:hover:text-white/70
                      "
                    >
                      {showPassword
                        ? "Hide"
                        : "Show"}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {message && (
                  <div
                    className="
                      rounded-xl
                      border border-red-500/15
                      bg-red-500/[0.06]
                      px-4 py-3
                      text-xs
                      text-red-600
                      dark:text-red-400
                    "
                  >
                    {message}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="
                    mt-1
                    flex h-12 w-full
                    items-center justify-center gap-2
                    rounded-xl
                    bg-zinc-950
                    px-4
                    text-sm font-semibold
                    text-white
                    shadow-lg
                    transition
                    hover:bg-zinc-800
                    active:scale-[0.99]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    dark:bg-white
                    dark:text-black
                    dark:hover:bg-white/90
                  "
                >
                  {loading ? (
                    <>
                      <span
                        className="
                          h-4 w-4 animate-spin
                          rounded-full
                          border-2
                          border-current
                          border-t-transparent
                        "
                      />
                      Creating account...
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-7 flex items-center gap-3">
                <span
                  className="
                    h-px flex-1
                    bg-black/[0.07]
                    dark:bg-white/[0.08]
                  "
                />

                <span
                  className="
                    text-[9px] font-bold
                    tracking-widest
                    text-zinc-400
                    dark:text-white/25
                  "
                >
                  OR
                </span>

                <span
                  className="
                    h-px flex-1
                    bg-black/[0.07]
                    dark:bg-white/[0.08]
                  "
                />
              </div>

              {/* Login link */}
              <p
                className="
                  text-center text-xs
                  text-zinc-500
                  dark:text-white/40
                "
              >
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="
                    ml-1 font-semibold
                    text-zinc-900
                    hover:underline
                    dark:text-white
                  "
                >
                  Sign in
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}