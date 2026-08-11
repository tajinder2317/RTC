import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

// Send friend request
router.post(
  "/request/:userId",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const senderId = req.user!.userId;
      const receiverId = req.params.userId as string;

      if (senderId === receiverId) {
        return res.status(400).json({
          message: "You cannot send a friend request to yourself",
        });
      }

      const receiver = await prisma.user.findUnique({
        where: {
          id: receiverId,
        },
      });

      if (!receiver) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            {
              userAId: senderId,
              userBId: receiverId,
            },
            {
              userAId: receiverId,
              userBId: senderId,
            },
          ],
        },
      });

      if (existingFriendship) {
        return res.status(409).json({
          message: "You are already friends",
        });
      }

      const existingRequest = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            {
              senderId,
              receiverId,
            },
            {
              senderId: receiverId,
              receiverId: senderId,
            },
          ],
        },
      });

      if (existingRequest) {
        if (existingRequest.status === "PENDING") {
          return res.status(409).json({
            message: "A friend request is already pending",
          });
        }

        if (existingRequest.status === "REJECTED") {
          const updatedRequest = await prisma.friendRequest.update({
            where: {
              id: existingRequest.id,
            },
            data: {
              senderId,
              receiverId,
              status: "PENDING",
            },
          });

          return res.status(201).json({
            message: "Friend request sent",
            request: updatedRequest,
          });
        }
      }

      const request = await prisma.friendRequest.create({
        data: {
          senderId,
          receiverId,
        },
      });

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
  },
);

// Get incoming friend requests
router.get(
  "/requests",
  authenticateToken,
  async (req: AuthRequest, res) => {
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
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
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
  },
);

// Accept friend request
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
      });

      if (!request) {
        return res.status(404).json({
          message: "Friend request not found",
        });
      }

      if (request.receiverId !== userId) {
        return res.status(403).json({
          message: "You cannot accept this friend request",
        });
      }

      if (request.status !== "PENDING") {
        return res.status(400).json({
          message: "This friend request is no longer pending",
        });
      }

      const friendship = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.friendRequest.update({
          where: {
            id: requestId,
          },
          data: {
            status: "ACCEPTED",
          },
        });

        const friendship = await tx.friendship.create({
          data: {
            userAId: request.senderId,
            userBId: request.receiverId,
          },
        });

        return friendship;
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

// Reject friend request
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
          message: "You cannot reject this friend request",
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

// Get friends
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res) => {
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

      const friends = friendships.map((friendship) => {
        return friendship.userAId === userId
          ? friendship.userB
          : friendship.userA;
      });

      return res.json({
        friends,
      });
    } catch (error) {
      console.error("Get friends error:", error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  },
);

// Remove friend
router.delete(
  "/:userId",
  authenticateToken,
  async (req: AuthRequest, res) => {
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
  },
);

export default router;