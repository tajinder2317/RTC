import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

const conversationInclude = {
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
} as const;

const getDirectConversationKey = (userAId: string, userBId: string) =>
  [userAId, userBId].sort().join(":");

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

    const directKey = getDirectConversationKey(currentUserId, otherUserId);

    // First, try to find existing conversation by directKey (most reliable)
    let existingConversation = await prisma.conversation.findFirst({
      where: {
        directKey,
        type: "DIRECT",
      },
      include: conversationInclude,
    });

    if (existingConversation) {
      return res.json({
        message: "Conversation already exists",
        conversation: existingConversation,
      });
    }

    // Fallback: search for conversations without directKey (legacy data)
    const legacyConversations = await prisma.conversation.findMany({
      where: {
        type: "DIRECT",
        directKey: null,
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
      include: conversationInclude,
      orderBy: {
        createdAt: "asc",
      },
    });

    if (legacyConversations.length > 0) {
      const oldestConversation = legacyConversations[0];

      if (!oldestConversation) {
        return res.status(500).json({
          message: "Error retrieving conversation",
        });
      }

      if (legacyConversations.length > 1) {
        console.warn("Duplicate direct conversations detected (legacy without directKey):", {
          userAId: currentUserId,
          userBId: otherUserId,
          conversationIds: legacyConversations.map((conversation) => conversation.id),
        });
      }

      // Backfill directKey to prevent future duplicates
      try {
        existingConversation = await prisma.conversation.update({
          where: {
            id: oldestConversation.id,
          },
          data: {
            directKey,
          },
          include: conversationInclude,
        });

        return res.json({
          message: "Conversation already exists",
          conversation: existingConversation,
        });
      } catch (error) {
        console.error("Direct conversation key backfill error:", error);
        // If backfill fails, still return the existing conversation
        return res.json({
          message: "Conversation already exists",
          conversation: oldestConversation,
        });
      }
    }

    // Create new conversation with directKey to prevent duplicates
    try {
      const conversation = await prisma.conversation.create({
        data: {
          type: "DIRECT",
          directKey,
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
        include: conversationInclude,
      });

      return res.status(201).json({
        message: "Conversation created successfully",
        conversation,
      });
    } catch (error) {
      const isUniqueConstraintError =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";

      if (isUniqueConstraintError) {
        // Race condition: another request created the conversation simultaneously
        const raceConditionConversation = await prisma.conversation.findFirst({
          where: {
            directKey,
          },
          include: conversationInclude,
        });

        if (raceConditionConversation) {
          return res.json({
            message: "Conversation already exists",
            conversation: raceConditionConversation,
          });
        }
      }

      throw error;
    }
  } catch (error) {
    console.error("Create conversation error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Get all conversations for current user
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

    const uniqueConversations = Array.from(
      conversations
        .reduce((map, conversation) => {
          const conversationKey =
            conversation.directKey ??
            (conversation.type === "DIRECT" && conversation.members.length === 2
              ? conversation.members
                  .map((member) => member.user.id)
                  .sort()
                  .join(":")
              : conversation.id);

          const existingConversation = map.get(conversationKey);

          if (!existingConversation) {
            map.set(conversationKey, conversation);
            return map;
          }

          const currentTime = conversation.messages[0]?.createdAt
            ? new Date(conversation.messages[0].createdAt).getTime()
            : new Date(conversation.createdAt).getTime();

          const existingTime = existingConversation.messages[0]?.createdAt
            ? new Date(existingConversation.messages[0].createdAt).getTime()
            : new Date(existingConversation.createdAt).getTime();

          if (currentTime > existingTime) {
            map.set(conversationKey, conversation);
          }

          return map;
        }, new Map<string, (typeof conversations)[number]>())
        .values(),
    );

    // Sort by latest message
    uniqueConversations.sort((a, b) => {
      const aTime = a.messages[0]?.createdAt
        ? new Date(a.messages[0].createdAt).getTime()
        : new Date(a.createdAt).getTime();

      const bTime = b.messages[0]?.createdAt
        ? new Date(b.messages[0].createdAt).getTime()
        : new Date(b.createdAt).getTime();

      return bTime - aTime;
    });

    return res.json({
      conversations: uniqueConversations,
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

      const unreadMessages = await prisma.message.findMany({
        where: {
          conversationId,
          senderId: {
            not: userId,
          },
          readAt: null,
        },
        select: {
          id: true,
        },
      });

      const readAt = new Date();

      await prisma.$transaction([
        prisma.conversationMember.update({
          where: {
            userId_conversationId: {
              userId,
              conversationId,
            },
          },
          data: {
            lastReadAt: readAt,
          },
        }),
        ...(unreadMessages.length > 0
          ? [
              prisma.message.updateMany({
                where: {
                  id: {
                    in: unreadMessages.map((message) => message.id),
                  },
                },
                data: {
                  readAt,
                },
              }),
            ]
          : []),
      ]);

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
