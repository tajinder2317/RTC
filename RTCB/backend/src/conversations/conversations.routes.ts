import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

// Create or get a conversation with another user
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.userId;
    const { userId: otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({
        message: "Other user ID is required",
      });
    }

    if (currentUserId === otherUserId) {
      return res.status(400).json({
        message: "You cannot create a conversation with yourself",
      });
    }

    const otherUser = await prisma.user.findUnique({
      where: {
        id: otherUserId,
      },
    });

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            members: {
              some: {
                userId: currentUserId,
              },
            },
          },
          {
            members: {
              some: {
                userId: otherUserId,
              },
            },
          },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (existingConversation) {
      return res.json({
        message: "Conversation already exists",
        conversation: existingConversation,
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        members: {
          create: [
            {
              userId: currentUserId,
            },
            {
              userId: otherUserId,
            },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json({
      message: "Conversation created successfully",
      conversation,
    });
  } catch (error) {
    console.error("Create conversation error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Get all conversations for current user
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const memberships = await prisma.conversationMember.findMany({
      where: {
        userId,
      },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                  },
                },
              },
            },
            messages: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                text: true,
                senderId: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          createdAt: "desc",
        },
      },
    });

    const conversations = await Promise.all(
      memberships.map(async (membership) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: membership.conversationId,
            senderId: {
              not: userId,
            },
            ...(membership.lastReadAt
              ? {
                  createdAt: {
                    gt: membership.lastReadAt,
                  },
                }
              : {}),
          },
        });

        return {
          ...membership.conversation,
          unreadCount,
        };
      }),
    );

    return res.json({
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});
router.post(
  "/:conversationId/read",
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

      await prisma.conversationMember.update({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      return res.json({
        message: "Conversation marked as read",
      });
    } catch (error) {
      console.error("Mark conversation read error:", error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },
);

export default router;
