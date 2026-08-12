import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import authRoutes from "./auth/auth.routes.js";
import usersRoutes from "./users/users.routes.js";
import friendsRoutes from "./friends/friends.routes.js";
import conversationRoutes from "./conversations/conversations.routes.js";
import messageRoutes from "./messages/messages.routes.js";
import { registerChatSocket } from "./chat/chat.socket.js";
import { registerFriendsSocket } from "./friends/friends.socket.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Backend is running!",
  });
});

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/friends", friendsRoutes);
app.use("/conversations", conversationRoutes);
app.use("/messages", messageRoutes);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

registerChatSocket(io);
registerFriendsSocket(io);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
