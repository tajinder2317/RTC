import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser, loginUser } from "../../services/api";
import { useAuthStore } from "./authStore";

export default function Register() {
  const [username, setUsername] = useState("");
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
      const data = await registerUser(username, email, password);

      if (data?.token && data?.user) {
        login(data.token, data.user);
      } else {
        const loginData = await loginUser(email, password);
        login(loginData.token, loginData.user);
      }

      navigate("/chat", { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("Registration failed");
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
                Meet.
                <br />
                Message.
                <br />
                Connect.
              </h2>

              <p>
                Create your account and start having real-time conversations
                with your friends.
              </p>
            </div>

            <div className="hero-decoration">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>

        {/* Register panel */}
        <section className="auth-panel">
          <div className="auth-content">
            <div className="auth-heading">
              <span className="mobile-brand-mark">RTC</span>

              <h1>Create your account</h1>
              <p>It only takes a moment to get started.</p>
            </div>

         <form className="auth-form register-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="register-username">Username</label>

                <input
                  id="register-username"
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="register-email">Email</label>

                <input
                  id="register-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="register-password">Password</label>

                <div className="password-input">
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            <div className="auth-divider">
              <span />
              <p>OR</p>
              <span />
            </div>

            <p className="auth-switch">
              Already have an account?
              <Link to="/login">Sign in</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}