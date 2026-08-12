import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import type { AuthRequest } from "../middleware/authMiddleware.js";
const router = Router();

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

export default router;
