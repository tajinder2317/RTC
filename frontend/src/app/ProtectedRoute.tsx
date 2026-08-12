import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/authStore";
import { connectSocket, disconnectSocket } from "../services/socket";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }

    connectSocket(token);

    return () => {
      disconnectSocket();
    };
  }, [token]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
