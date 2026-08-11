import { useEffect, useState } from "react";
import { useAuthStore } from "../auth/authStore";

type User = {
  id: string;
  username: string;
  email: string;
};

export default function ChatScreen() {
  const token = useAuthStore((state) => state.token);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("http://localhost:5000/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch users");
        }

        setUsers(data.users);
      } catch (error) {
        console.error("Fetch users error:", error);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchUsers();
    }
  }, [token]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#111",
        padding: "40px",
      }}
    >
      <h1>Real-Time Chat</h1>

      <h2>Users</h2>

      {loading && <p>Loading users...</p>}

      {error && <p>{error}</p>}

      {!loading && !error && users.length === 0 && <p>No other users found.</p>}

      {!loading &&
        !error &&
        users.map((user) => (
          <div
            key={user.id}
            style={{
              background: "white",
              padding: "15px",
              marginBottom: "10px",
              borderRadius: "8px",
              border: "1px solid #ddd",
            }}
          >
            <strong>{user.username}</strong>

            <div style={{ color: "#666" }}>{user.email}</div>

            <button
              style={{
                marginTop: "10px",
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              Chat
            </button>
          </div>
        ))}
    </div>
  );
}
