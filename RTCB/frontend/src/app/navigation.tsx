import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "../features/auth/Login";
import Register from "../features/auth/Register";

export default function Navigation() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
