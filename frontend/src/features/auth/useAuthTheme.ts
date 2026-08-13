import { useEffect, useState } from "react";

export type AuthTheme = "dark" | "light";

const STORAGE_KEY = "rtc-theme";

function getInitialTheme(): AuthTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  return saved === "light" || saved === "dark"
    ? saved
    : "dark";
}

export function useAuthTheme() {
  const [theme, setTheme] = useState<AuthTheme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "dark" ? "light" : "dark",
    );
  };

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
  };
}