import { create } from "zustand";

type User = {
  id: string;
  username: string;
  email: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;

  login: (token: string, user: User) => void;
  logout: () => void;
};

function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw || raw === "undefined" || raw === "null") {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.id && parsed.username) {
      return parsed as User;
    }
    localStorage.removeItem("user");
    return null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

const initialToken = localStorage.getItem("token") || null;
const initialUser = getInitialUser();

export const useAuthStore = create<AuthState>((set) => ({
  token: initialToken,
  user: initialUser,
  isAuthenticated: !!(initialToken && initialUser),

  login: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    set({
      token,
      user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));

