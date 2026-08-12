import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";
import {
  emitFriendRequestAccepted,
  emitFriendRequestNew,
} from "./friends.socket.js";

const router = Router();

type FriendRelationship =
  | "SELF"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NOT_FRIENDS";

const normalizeFriendPair = (
  userIdA: string,
  userIdB: string,
): [string, string] => (userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA]);

const validateFriendship = async (currentUserId: string, otherUserId: string) => {
  return prisma.friendship.findFirst({
    where: {
      OR: [
        {
          userAId: currentUserId,
          userBId: otherUserId,
        },
        {
          userAId: otherUserId,
          userBId: currentUserId,
        },
      ],
    },
    select: {
      id: true,
    },
  });
};

const buildFriendRequestInclude = {
  sender: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
  receiver: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
} as const;

const sendFriendRequestHandler = async (req: AuthRequest, res: any) => {
  try {
    const senderId = req.user!.userId;
    const receiverId = String(req.body?.receiverId || req.params.userId || "");

    if (!receiverId) {
      return res.status(400).json({
        message: "Receiver ID is required",
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({
        message: "Cannot send friend request to yourself",
      });
    }

    const receiver = await prisma.user.findUnique({
      where: {
        id: receiverId,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!receiver) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const existingFriendship = await validateFriendship(senderId, receiverId);

    if (existingFriendship) {
      return res.status(409).json({
        message: "Users are already friends",
      });
    }

    const outgoingRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId,
        receiverId,
      },
    });

    if (outgoingRequest?.status === "PENDING") {
      return res.status(409).json({
        message: "Friend request already exists",
      });
    }

    const incomingRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId: receiverId,
        receiverId: senderId,
        status: "PENDING",
      },
    });

    if (incomingRequest) {
      const friendship = await prisma.$transaction(async (tx) => {
        await tx.friendRequest.update({
          where: {
            id: incomingRequest.id,
          },
          data: {
            status: "ACCEPTED",
          },
        });

        const [userAId, userBId] = normalizeFriendPair(senderId, receiverId);

        return tx.friendship.create({
          data: {
            userAId,
            userBId,
          },
        });
      });

      emitFriendRequestAccepted(receiverId, {
        friendship,
        friend: {
          id: senderId,
          username: req.user!.username,
        },
      });
      emitFriendRequestAccepted(senderId, {
        friendship,
        friend: receiver,
      });

      return res.status(200).json({
        message: "Friend request accepted",
        friendship,
      });
    }

    if (outgoingRequest && outgoingRequest.status === "REJECTED") {
      const updatedRequest = await prisma.friendRequest.update({
        where: {
          id: outgoingRequest.id,
        },
        data: {
          status: "PENDING",
        },
        include: buildFriendRequestInclude,
      });

      emitFriendRequestNew(receiverId, updatedRequest);

      return res.status(201).json({
        message: "Friend request sent",
        request: updatedRequest,
      });
    }

    const request = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
      },
      include: buildFriendRequestInclude,
    });

    emitFriendRequestNew(receiverId, request);

    return res.status(201).json({
      message: "Friend request sent",
      request,
    });
  } catch (error) {
    console.error("Send friend request error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

router.post("/requests", authenticateToken, sendFriendRequestHandler);
router.post("/request/:userId", authenticateToken, sendFriendRequestHandler);

router.get("/requests", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const requests = await prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: buildFriendRequestInclude,
    });

    return res.json({
      requests,
    });
  } catch (error) {
    console.error("Get friend requests error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.post(
  "/requests/:requestId/accept",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const requestId = req.params.requestId as string;

      const request = await prisma.friendRequest.findUnique({
        where: {
          id: requestId,
        },
        include: buildFriendRequestInclude,
      });

      if (!request) {
        return res.status(404).json({
          message: "Friend request not found",
        });
      }

      if (request.receiverId !== userId) {
        return res.status(403).json({
          message: "Not authorized",
        });
      }

      if (request.status !== "PENDING") {
        return res.status(400).json({
          message: "This friend request is no longer pending",
        });
      }

      const friendship = await prisma.$transaction(async (tx) => {
        await tx.friendRequest.update({
          where: {
            id: requestId,
          },
          data: {
            status: "ACCEPTED",
          },
        });

        const [userAId, userBId] = normalizeFriendPair(
          request.senderId,
          request.receiverId,
        );

        return tx.friendship.create({
          data: {
            userAId,
            userBId,
          },
        });
      });

      emitFriendRequestAccepted(request.senderId, {
        friendship,
        friend: request.receiver,
      });
      emitFriendRequestAccepted(request.receiverId, {
        friendship,
        friend: request.sender,
      });

      return res.json({
        message: "Friend request accepted",
        friendship,
      });
    } catch (error) {
      console.error("Accept friend request error:", error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },
);

router.post(
  "/requests/:requestId/reject",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const requestId = req.params.requestId as string;

      const request = await prisma.friendRequest.findUnique({
        where: {
          id: requestId,
        },
      });

      if (!request) {
        return res.status(404).json({
          message: "Friend request not found",
        });
      }

      if (request.receiverId !== userId) {
        return res.status(403).json({
          message: "Not authorized",
        });
      }

      if (request.status !== "PENDING") {
        return res.status(400).json({
          message: "This friend request is no longer pending",
        });
      }

      await prisma.friendRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: "REJECTED",
        },
      });

      return res.json({
        message: "Friend request rejected",
      });
    } catch (error) {
      console.error("Reject friend request error:", error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },
);

router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          {
            userAId: userId,
          },
          {
            userBId: userId,
          },
        ],
      },
      include: {
        userA: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        userB: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    const friends = friendships.map((friendship) =>
      friendship.userAId === userId ? friendship.userB : friendship.userA,
    );

    return res.json({
      friends,
    });
  } catch (error) {
    console.error("Get friends error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.delete("/:userId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const friendId = req.params.userId as string;

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          {
            userAId: userId,
            userBId: friendId,
          },
          {
            userAId: friendId,
            userBId: userId,
          },
        ],
      },
    });

    if (!friendship) {
      return res.status(404).json({
        message: "Friendship not found",
      });
    }

    await prisma.friendship.delete({
      where: {
        id: friendship.id,
      },
    });

    return res.json({
      message: "Friend removed",
    });
  } catch (error) {
    console.error("Remove friend error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;
