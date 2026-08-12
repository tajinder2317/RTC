import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";
const router = Router();

type RelationshipStatus =
  | "SELF"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NOT_FRIENDS";

const buildRelationshipMap = async (currentUserId: string) => {
  const [friendships, requests] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        OR: [
          {
            userAId: currentUserId,
          },
          {
            userBId: currentUserId,
          },
        ],
      },
      select: {
        id: true,
        userAId: true,
        userBId: true,
      },
    }),
    prisma.friendRequest.findMany({
      where: {
        OR: [
          {
            senderId: currentUserId,
          },
          {
            receiverId: currentUserId,
          },
        ],
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        status: true,
      },
    }),
  ]);

  const map = new Map<
    string,
    {
      relationship: RelationshipStatus;
      friendRequestId?: string;
      friendshipId?: string;
    }
  >();

  friendships.forEach((friendship) => {
    const otherUserId =
      friendship.userAId === currentUserId ? friendship.userBId : friendship.userAId;

    map.set(otherUserId, {
      relationship: "FRIENDS",
      friendshipId: friendship.id,
    });
  });

  requests.forEach((request) => {
    if (request.status !== "PENDING") {
      return;
    }

    if (request.senderId === currentUserId) {
      map.set(request.receiverId, {
        relationship: "REQUEST_SENT",
        friendRequestId: request.id,
      });
      return;
    }

    if (request.receiverId === currentUserId && !map.has(request.senderId)) {
      map.set(request.senderId, {
        relationship: "REQUEST_RECEIVED",
        friendRequestId: request.id,
      });
    }
  });

  return map;
};

router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.userId;

    const users = await prisma.user.findMany({
      where: {
        id: {
          not: currentUserId,
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
      orderBy: {
        username: "asc",
      },
    });

    return res.json({
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.get("/search", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.userId;
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const relationshipMap = await buildRelationshipMap(currentUserId);

    const users = await prisma.user.findMany({
      ...(query
        ? {
            where: {
              username: {
                contains: query,
                mode: "insensitive",
              },
            },
          }
        : {}),
      select: {
        id: true,
        username: true,
        email: true,
      },
      orderBy: {
        username: "asc",
      },
    });

    const results = users.map((user) => {
      if (user.id === currentUserId) {
        return {
          ...user,
          relationship: "SELF" as RelationshipStatus,
        };
      }

      return {
        ...user,
        ...(relationshipMap.get(user.id) || {
          relationship: "NOT_FRIENDS" as RelationshipStatus,
        }),
      };
    });

    return res.json({
      users: results,
    });
  } catch (error) {
    console.error("Search users error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;
