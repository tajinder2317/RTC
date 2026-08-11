import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

// Send a message
router.post(
  "/:conversationId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const conversationId = req.params.conversationId as string;
      const { text } = req.body;
      const senderId = req.user!.userId;

      if (!text || !text.trim()) {
        return res.status(400).json({
          message: "Message text is required",
        });
      }

      const membership = await prisma.conversationMember.findUnique({
        where: {
          userId_conversationId: {
            userId: senderId,
            conversationId,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({
          message: "You are not a member of this conversation",
        });
      }

      const message = await prisma.message.create({
        data: {
          text: text.trim(),
          senderId,
          conversationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return res.status(201).json({
        message: "Message sent successfully",
        data: message,
      });
    } catch (error) {
      console.error("Send message error:", error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },
);

// Get messages
router.get(
  "/:conversationId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const conversationId = req.params.conversationId as string;
      const userId = req.user!.userId;

      const membership = await prisma.conversationMember.findUnique({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({
          message: "You are not a member of this conversation",
        });
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return res.json({
        messages,
      });
    } catch (error) {
      console.error("Get messages error:", error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },
);

export default router;
