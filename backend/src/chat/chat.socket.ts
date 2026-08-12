import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const onlineUsers = new Map<string, number>();

type JwtPayload = {
  userId: string;
  username: string;
};

export function registerChatSocket(io: Server) {
  // Authenticate every Socket.IO connection
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

      socket.data.userId = decoded.userId;
      socket.data.username = decoded.username;

      next();
    } catch (error) {
      console.error("Socket authentication failed:", error);
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;

    const currentConnections = onlineUsers.get(userId) ?? 0;

    onlineUsers.set(userId, currentConnections + 1);

    if (currentConnections === 0) {
      socket.broadcast.emit("userOnline", {
        userId,
        username,
      });
    }
    socket.emit("onlineUsers", {
      userIds: Array.from(onlineUsers.keys()),
    });

    console.log(
      `Socket connected: ${socket.id} | User: ${username} (${userId})`,
    );

    // Put the user in their personal room
    socket.join(`user:${userId}`);

    socket.on("joinConversation", async (conversationId: string) => {
      try {
        const membership = await prisma.conversationMember.findUnique({
          where: {
            userId_conversationId: {
              userId,
              conversationId,
            },
          },
        });

        if (!membership) {
          console.log("User is not a member of this conversation");
          return;
        }

        socket.join(conversationId);

        console.log(
          `Socket ${socket.id} joined conversation ${conversationId}`,
        );
      } catch (error) {
        console.error("Join conversation error:", error);
      }
    });

    socket.on("typing", (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit("userTyping", {
        userId,
        username,
      });
    });

    socket.on("stopTyping", (data: { conversationId: string }) => {
      socket.to(data.conversationId).emit("userStoppedTyping", {
        userId,
      });
    });

    socket.on(
      "sendMessage",
      async (data: { conversationId: string; text: string }) => {
        try {
          const { conversationId, text } = data;

          if (!conversationId || !text?.trim()) {
            return;
          }

          const membership = await prisma.conversationMember.findUnique({
            where: {
              userId_conversationId: {
                userId,
                conversationId,
              },
            },
          });

          if (!membership) {
            console.log("User is not a member of this conversation");
            return;
          }

          const message = await prisma.message.create({
            data: {
              conversationId,
              senderId: userId,
              text: text.trim(),
            },
          });

          const members = await prisma.conversationMember.findMany({
            where: {
              conversationId,
            },
            select: {
              userId: true,
            },
          });

          const recipientIds = members
            .map((member) => member.userId)
            .filter((memberId) => memberId !== userId);

          for (const memberId of recipientIds) {
            io.to(`user:${memberId}`).emit("newMessage", message);
          }

          io.to(`user:${userId}`).emit("newMessage", message);
        } catch (error) {
          console.error("Send message error:", error);
        }
      },
    );

    socket.on("messageDelivered", async (data: { messageId: string }) => {
      try {
        const { messageId } = data;

        const message = await prisma.message.findUnique({
          where: {
            id: messageId,
          },
        });

        if (!message) {
          return;
        }

        // Don't allow the sender to mark their own message delivered
        if (message.senderId === userId) {
          return;
        }

        const updatedMessage = await prisma.message.update({
          where: {
            id: messageId,
          },
          data: {
            deliveredAt: new Date(),
          },
        });

        io.to(`user:${message.senderId}`).emit("messageDelivered", {
          messageId: updatedMessage.id,
          deliveredAt: updatedMessage.deliveredAt,
        });
      } catch (error) {
        console.error("Message delivery error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id} | User: ${username}`);

      const currentConnections = onlineUsers.get(userId) ?? 0;

      if (currentConnections <= 1) {
        onlineUsers.delete(userId);

        socket.broadcast.emit("userOffline", {
          userId,
        });
      } else {
        onlineUsers.set(userId, currentConnections - 1);
      }
    });
  });
}
