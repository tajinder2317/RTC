import React, { useEffect } from "react";
import Navigation from "./navigation";
import { useAuthStore } from "../features/auth/authStore";
import { connectSocket, disconnectSocket } from "../services/socket";

const App = () => {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket(token);
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, token]);

  return <Navigation />;
};

export default App;
