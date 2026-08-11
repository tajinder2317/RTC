import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { authenticateToken } from "./middleware/authMiddleware.js";
import type { AuthRequest } from "./middleware/authMiddleware.js";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
const app = express();

app.use(cors());
app.use(express.json());

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

app.get("/", (_req, res) => {
  res.json({
    message: "Backend is running!",
  });
});

app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email and password are required",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username or email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Registration failed",
      error: String(error),
    });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Internal server error",
      error: String(error),
    });
  }
});

app.get("/auth/me", authenticateToken, (req: AuthRequest, res) => {
  res.json({
    message: "You are authenticated",
    user: req.user,
  });
});

// API for the conversation part...

app.post("/conversations", authenticateToken, async (req: AuthRequest, res) => {
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

// -----------------------------------------

app.post(
  "/conversations/:conversationId/messages",
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

// ------------------------------------------

app.get(
  "/conversations/:conversationId/messages",
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

// ---------------------------------------------------------------

app.get("/conversations", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const conversations = await prisma.conversation.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
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
    });

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

const PORT = 5000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
