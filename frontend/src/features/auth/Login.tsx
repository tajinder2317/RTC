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
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-shell">
        {/* Brand panel */}
        <section className="auth-hero">
          <div className="auth-hero-content">
            <div className="brand-mark">RTC</div>

            <div className="hero-copy">
              <span className="hero-eyebrow">REAL-TIME CHAT</span>

              <h2>
                Talk.
                <br />
                Connect.
                <br />
                Stay close.
              </h2>

              <p>
                A simple place to have real-time conversations with the people
                who matter.
              </p>
            </div>

            <div className="hero-decoration">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>

        {/* Login panel */}
        <section className="auth-panel">
          <div className="auth-content">
            <div className="auth-heading">
              <span className="mobile-brand-mark">RTC</span>

              <h1>Welcome back</h1>
              <p>Sign in to continue to your conversations.</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="login-email">Email</label>

                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field">
                <div className="field-label-row">
                  <label htmlFor="login-password">Password</label>
                </div>

                <div className="password-input">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-button"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {message && <div className="auth-error">{message}</div>}

              <button
                className="auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="button-spinner" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="auth-divider">
              <span />
              <p>OR</p>
              <span />
            </div>

            <p className="auth-switch">
              Don't have an account?
              <Link to="/register">Create an account</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}