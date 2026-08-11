import type { Server } from "socket.io";
import { prisma } from "../lib/prisma.js";

export function registerChatSocket(io: Server) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinConversation", async (conversationId: string) => {
      socket.join(conversationId);

      console.log(
        `Socket ${socket.id} joined conversation ${conversationId}`
      );
    });

    socket.on(
      "sendMessage",
      async (data: {
        conversationId: string;
        text: string;
        senderId: string;
      }) => {
        try {
          const { conversationId, text, senderId } = data;

          if (!conversationId || !text || !senderId) {
            return;
          }

          const membership =
            await prisma.conversationMember.findUnique({
              where: {
                userId_conversationId: {
                  userId: senderId,
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
              senderId,
              text,
            },
          });

          io.to(conversationId).emit("newMessage", message);
        } catch (error) {
          console.error("Send message error:", error);
        }
      }
    );

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
}