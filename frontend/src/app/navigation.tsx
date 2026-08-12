import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "../features/auth/Login";
import Register from "../features/auth/Register";
import ChatScreen from "../features/chat/ChatScreen";
import Friends from "../features/friends/Friends";
import ProtectedRoute from "./ProtectedRoute";

export default function Navigation() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatScreen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
