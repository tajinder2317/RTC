import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../../services/api";
import { useAuthStore } from "./authStore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const data = await loginUser(email, password);

      login(data.token, data.user);
      navigate("/chat", { replace: true });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--rtc-bg)] p-4 text-[var(--rtc-text)] sm:p-6">
      <div className="grid min-h-[640px] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[var(--rtc-border)] bg-[var(--rtc-panel)] shadow-[0_30px_100px_var(--rtc-shadow)] backdrop-blur-2xl lg:grid-cols-[0.9fr_1.1fr]">
        
        {/* HERO */}
        <section className="relative hidden overflow-hidden border-r border-[var(--rtc-border)] bg-[var(--rtc-panel)] lg:flex">
          <div className="relative z-10 flex w-full flex-col justify-between p-12">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--rtc-border-strong)] bg-[var(--rtc-surface)] text-[11px] font-extrabold tracking-[0.08em] shadow-[0_12px_30px_var(--rtc-shadow)]">
              RTC
            </div>

            <div className="max-w-sm">
              <span className="mb-5 block text-[10px] font-bold tracking-[0.18em] text-[var(--rtc-text-muted)]">
                REAL-TIME CHAT
              </span>

              <h2 className="text-5xl font-bold leading-[0.98] tracking-[-0.055em] xl:text-6xl">
                Talk.
                <br />
                Connect.
                <br />
                Stay close.
              </h2>

              <p className="mt-6 max-w-xs text-sm leading-7 text-[var(--rtc-text-muted)]">
                A simple place to have real-time conversations
                with the people who matter.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-7 rounded-full bg-[var(--rtc-text-soft)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--rtc-text-faint)]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--rtc-text-faint)]" />
            </div>
          </div>

          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/[0.035] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/[0.025] blur-3xl" />
        </section>

        {/* FORM */}
        <section className="flex min-h-[640px] items-center justify-center bg-[var(--rtc-bg)]">
          <div className="w-full max-w-[420px] px-6 py-10 sm:px-10 lg:px-12">
            
            <div className="mb-8">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--rtc-border-strong)] bg-[var(--rtc-surface)] text-[11px] font-extrabold tracking-[0.08em] shadow-[0_12px_30px_var(--rtc-shadow)] lg:hidden">
                RTC
              </div>

              <h1 className="text-[30px] font-bold tracking-[-0.035em]">
                Welcome back
              </h1>

              <p className="mt-2 text-[13px] leading-6 text-[var(--rtc-text-muted)]">
                Sign in to continue to your conversations.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5"
            >
              {/* EMAIL */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="login-email"
                  className="text-[11px] font-semibold text-[var(--rtc-text-soft)]"
                >
                  Email
                </label>

                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-12 w-full rounded-xl border border-[var(--rtc-border)] bg-[var(--rtc-input)] px-3.5 text-[13px] text-[var(--rtc-text)] outline-none transition placeholder:text-[var(--rtc-text-faint)] hover:border-[var(--rtc-border-strong)] focus:border-[var(--rtc-border-strong)] focus:bg-[var(--rtc-input-focus)] focus:ring-3 focus:ring-[var(--rtc-selected)]"
                />
              </div>

              {/* PASSWORD */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="login-password"
                  className="text-[11px] font-semibold text-[var(--rtc-text-soft)]"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-12 w-full rounded-xl border border-[var(--rtc-border)] bg-[var(--rtc-input)] px-3.5 pr-16 text-[13px] text-[var(--rtc-text)] outline-none transition placeholder:text-[var(--rtc-text-faint)] hover:border-[var(--rtc-border-strong)] focus:border-[var(--rtc-border-strong)] focus:bg-[var(--rtc-input-focus)] focus:ring-3 focus:ring-[var(--rtc-selected)]"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[var(--rtc-text-muted)] transition hover:bg-[var(--rtc-surface)] hover:text-[var(--rtc-text)]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* ERROR */}
              {message && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2.5 text-[11px] leading-5 text-red-400">
                  {message}
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--rtc-border-strong)] bg-[var(--rtc-text)] text-[12px] font-bold text-[var(--rtc-bg)] transition hover:opacity-90 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* DIVIDER */}
            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-[var(--rtc-border)]" />
              <span className="text-[9px] font-bold tracking-[0.12em] text-[var(--rtc-text-faint)]">
                OR
              </span>
              <span className="h-px flex-1 bg-[var(--rtc-border)]" />
            </div>

            <p className="text-center text-[11px] text-[var(--rtc-text-muted)]">
              Don't have an account?
              <Link
                to="/register"
                className="ml-1 font-bold text-[var(--rtc-text)] hover:underline hover:underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}