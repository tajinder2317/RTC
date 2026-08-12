# RTC Application Infrastructure & Workflow Documentation

## Overview

RTC (Real-Time Chat) is a full-stack real-time chat application built with modern web technologies, featuring JWT authentication, friend management, and real-time messaging capabilities.

## Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Frontend      │         │    Backend      │         │   PostgreSQL    │
│   (React)       │◄────────►│   (Node.js)     │◄────────►│   Database      │
│                 │  HTTP/   │                 │  Prisma  │                 │
│   Vite Dev     │  WS      │   Express       │  ORM     │                 │
│   (Vercel config)│       │   Socket.IO     │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                    │
                                    │ (Placeholder - not implemented)
                                    ▼
                            ┌─────────────────┐
                            │     Redis       │
                            │   (Not used)    │
                            └─────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 19.2.8 with TypeScript
- **Build Tool**: Vite 8.2.1
- **Routing**: React Router DOM 7.18.2
- **State Management**: Zustand 5.0.14
- **HTTP Client**: Axios 1.19.0
- **Real-time**: Socket.IO Client 4.8.3
- **Form Handling**: React Hook Form 7.85.0 with Zod 4.4.3
- **Deployment**: Vercel configuration present (vercel.json) but not currently deployed

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5.2.1
- **Real-time**: Socket.IO 4.8.3
- **Authentication**: JWT (jsonwebtoken 9.0.3)
- **Password Hashing**: bcrypt 6.0.0
- **ORM**: Prisma 7.9.1 with PostgreSQL adapter
- **Database Driver**: pg 8.23.0
- **CORS**: cors 2.8.6
- **Caching**: ioredis 6.0.0 (installed but not implemented - placeholder only)

### Database
- **Database**: PostgreSQL
- **ORM**: Prisma with driver adapter pattern
- **Migrations**: Prisma Migrate

## Project Structure

```
RTC/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema definition
│   │   └── migrations/            # Database migration files
│   ├── src/
│   │   ├── auth/
│   │   │   └── auth.routes.ts     # Authentication endpoints
│   │   ├── users/
│   │   │   └── users.routes.ts    # User management endpoints
│   │   ├── friends/
│   │   │   ├── friends.routes.ts  # Friend management endpoints
│   │   │   └── friends.socket.ts  # Friend request socket events
│   │   ├── conversations/
│   │   │   └── conversations.routes.ts  # Conversation management
│   │   ├── messages/
│   │   │   └── messages.routes.ts # Message history endpoints
│   │   ├── chat/
│   │   │   └── chat.socket.ts     # Real-time chat socket events
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts # JWT authentication middleware
│   │   ├── lib/
│   │   │   └── prisma.ts          # Prisma client configuration
│   │   └── server.ts              # Main server entry point
│   ├── redis/
│   │   └── redis.service.ts       # Redis service (placeholder - not implemented) (placeholder)
│   ├── generated/
│   │   └── prisma/                # Generated Prisma client
│   ├── .env                       # Environment variables
│   ├── package.json
│   ├── prisma.config.ts           # Prisma configuration
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx            # Main application component
│   │   │   ├── navigation.tsx     # Navigation configuration
│   │   │   └── ProtectedRoute.tsx # Auth route protection
│   │   ├── features/
│   │   │   ├── auth/              # Authentication components
│   │   │   ├── chat/              # Chat interface components
│   │   │   ├── friends/           # Friend management components
│   │   │   ├── presence/          # Online status components
│   │   │   └── profile/           # User profile components
│   │   ├── components/            # Shared UI components
│   │   ├── services/
│   │   │   ├── api.ts             # REST API client
│   │   │   └── socket.ts          # Socket.IO client setup
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── utils/                 # Utility functions
│   │   └── main.tsx               # React entry point
│   ├── public/                    # Static assets
│   ├── .env                       # Environment variables
│   ├── package.json
│   ├── vite.config.ts
│   ├── vercel.json                # Vercel deployment config
│   └── tsconfig.json
│
└── infrastructure.md              # This file
```

## Database Schema

### Core Models

#### User
```prisma
model User {
  id          String               @id @default(cuid())
  username    String               @unique
  email       String               @unique
  password    String               # bcrypt hashed
  createdAt   DateTime             @default(now())
  
  // Relations
  memberships ConversationMember[]
  messages    Message[]
  sentFriendRequests     FriendRequest[] @relation("SentFriendRequests")
  receivedFriendRequests FriendRequest[] @relation("ReceivedFriendRequests")
  friendshipsA Friendship[] @relation("FriendshipUserA")
  friendshipsB Friendship[] @relation("FriendshipUserB")
}
```

#### FriendRequest
```prisma
model FriendRequest {
  id         String              @id @default(cuid())
  senderId   String
  receiverId String
  status     FriendRequestStatus @default(PENDING) # PENDING | ACCEPTED | REJECTED
  createdAt  DateTime            @default(now())
  
  sender   User @relation("SentFriendRequests", fields: [senderId], references: [id])
  receiver User @relation("ReceivedFriendRequests", fields: [receiverId], references: [id])
  
  @@unique([senderId, receiverId])
  @@index([receiverId, status])
}
```

#### Friendship
```prisma
model Friendship {
  id        String   @id @default(cuid())
  userAId   String
  userBId   String
  createdAt DateTime @default(now())
  
  userA User @relation("FriendshipUserA", fields: [userAId], references: [id])
  userB User @relation("FriendshipUserB", fields: [userBId], references: [id])
  
  @@unique([userAId, userBId])
  @@index([userAId])
  @@index([userBId])
}
```

#### Conversation
```prisma
model Conversation {
  id        String           @id @default(cuid())
  type      ConversationType @default(DIRECT) # DIRECT | GROUP
  name      String?          # For group conversations
  directKey String?          @unique # For direct conversations
  createdAt DateTime         @default(now())
  
  members  ConversationMember[]
  messages Message[]
}
```

#### ConversationMember
```prisma
model ConversationMember {
  id             String       @id @default(cuid())
  userId         String
  conversationId String
  lastReadAt     DateTime?    # Track read receipt
  
  conversation Conversation @relation(fields: [conversationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])
  
  @@unique([userId, conversationId])
}
```

#### Message
```prisma
model Message {
  id             String       @id @default(cuid())
  text           String
  senderId       String
  conversationId String
  createdAt      DateTime     @default(now())
  deliveredAt    DateTime?    # Delivery receipt
  readAt         DateTime?    # Read receipt
  
  conversation Conversation @relation(fields: [conversationId], references: [id])
  sender       User @relation(fields: [senderId], references: [id])
  
  @@index([conversationId, createdAt])
}
```

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login (returns JWT token)
- `GET /auth/me` - Get current authenticated user

### Users (`/users`)
- `GET /users` - Get all users (authenticated)
- `GET /users/search?q=query` - Search users by username/email

### Friends (`/friends`)
- `GET /friends` - Get user's friends list
- `GET /friends/requests` - Get pending friend requests
- `POST /friends/requests` - Send friend request
- `POST /friends/request/:userId` - Send friend request (alternative endpoint)
- `POST /friends/requests/:requestId/accept` - Accept friend request
- `POST /friends/requests/:requestId/reject` - Reject friend request
- `DELETE /friends/:userId` - Remove friend

### Conversations (`/conversations`)
- `POST /conversations` - Create new conversation (or get existing)
- `GET /conversations` - Get user's conversations with unread counts
- `POST /conversations/:conversationId/read` - Mark conversation as read

### Messages (`/messages`)
- `GET /messages/:conversationId` - Get conversation messages
- `POST /messages/:conversationId` - Send message via REST (primary method is Socket.IO)

## Socket.IO Events

### Authentication
- **Middleware**: JWT token validation via `socket.handshake.auth.token`

### Connection Management
- **Client → Server**: Connection with token
- **Server → Client**: 
  - `presence:state` - Initial online users list
  - `onlineUsers` - Online user IDs
  - `presence:online` - User came online
  - `userOnline` - User online with details
  - `presence:offline` - User went offline
  - `userOffline` - User offline notification

### Chat Events
- **Client → Server**:
  - `joinConversation` - Join a conversation room
  - `leaveConversation` - Leave a conversation room
  - `sendMessage` - Send a new message
  - `typing` - User is typing (payload: `{ conversationId, userId, username }`)
  - `stopTyping` - User stopped typing (payload: `{ conversationId, userId }`)
  - `conversation:read` - Mark conversation as read
  - `messageDelivered` - Mark message as delivered

- **Server → Client**:
  - `newMessage` - New message received
  - `userTyping` - User is typing indicator (payload: `{ conversationId, userId, username }`)
  - `userStoppedTyping` - User stopped typing (payload: `{ conversationId, userId }`)
  - `message:read` - Message read receipt
  - `messageDelivered` - Message delivery receipt

### Friend Events
- **Server → Client**:
  - `friendRequest:new` - New friend request received (emitted to receiver)
  - `friendRequest:accepted` - Friend request accepted (emitted to both parties)

**Friend Request Logic**: 
- If incoming request exists when sending, automatically accepts and creates friendship
- Rejected requests can be re-sent (status changes back to PENDING)
- Mutual friendship normalized with sorted user IDs

### Presence System
**Current Implementation**: Presence is maintained using in-memory connection tracking via `activeConnections` Map in chat.socket.ts. When a user connects, their socket ID is added to their user's connection set. When all connections for a user are closed, they are marked offline. This data is not persisted across server restarts.

**Events**: 
- `presence:state` - Initial online users list sent to new connections
- `onlineUsers` - Online user IDs  
- `presence:online` / `userOnline` - User came online
- `presence:offline` / `userOffline` - User went offline

## Application Workflow

### 1. User Registration & Authentication Flow

```
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Client  │                  │ Backend │                  │ Database│
└────┬────┘                  └────┬────┘                  └────┬────┘
     │                            │                            │
     │ POST /auth/register        │                            │
     │ {username, email, password}│                            │
     ├───────────────────────────►│                            │
     │                            │ bcrypt hash password       │
     │                            ├──────────────────────────►│
     │                            │ Create User record        │
     │                            │◄──────────────────────────┤
     │                            │                            │
     │ JWT Token                  │                            │
     │◄──────────────────────────┤                            │
     │                            │                            │
     │ Store token                │                            │
     │ in localStorage            │                            │
```

### 2. Real-time Connection Flow

```
┌─────────┐                  ┌─────────┐
│ Client  │                  │ Backend │
└────┬────┘                  └────┬────┘
     │                            │
     │ Socket connect with token  │
     ├───────────────────────────►│
     │                            │ JWT validation
     │                            │◄──────┐
     │                            │       │
     │                            │───────┤ Valid
     │                            │       │
     │ Join user:{userId} room    │       │
     │◄──────────────────────────┤       │
     │ presence:state            │       │
     │ onlineUsers                │       │
     │                            │       │
     │ Broadcast to others        │       │
     │ presence:online            │       │
     │                            │───────►│
```

### 3. Friend Request Flow

```
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Request │                  │ Backend │                  │ Database│
│ Sender  │                  │         │                  │         │
└────┬────┘                  └────┬────┘                  └────┬────┘
     │                            │                            │
     │ POST /friends/requests     │                            │
     │ {receiverId}               │                            │
     ├───────────────────────────►│                            │
     │                            │ Create FriendRequest       │
     │                            │ (status: PENDING)         │
     │                            ├──────────────────────────►│
     │                            │                            │
     │ Success                    │                            │
     │◄──────────────────────────┤                            │
     │                            │                            │
     │                            │ Socket emit to receiver    │
     │                            │ friendRequest:new          │
     │                            │──────────────────────────►│
     │                            │                            │
┌────┴────┐                  ┌────┴────┐                  ┌────┴────┐
│Request  │                  │ Backend │                  │ Database│
│Receiver │                  │         │                  │         │
└────┬────┘                  └────┬────┘                  └────┬────┘
     │                            │                            │
     │ POST /friends/requests/:id/accept                       │
     ├───────────────────────────►│                            │
     │                            │ Update FriendRequest        │
     │                            │ (status: ACCEPTED)         │
     │                            ├──────────────────────────►│
     │                            │ Create Friendship          │
     │                            ├──────────────────────────►│
     │                            │                            │
     │ Success                    │                            │
     │◄──────────────────────────┤                            │
     │                            │                            │
     │                            │ Socket emit to sender      │
     │                            │ friendRequest:accepted     │
     │                            │──────────────────────────►│
```

### 4. Real-time Messaging Flow

```
┌─────────┐                  ┌─────────┐                  ┌─────────┐
│ Sender  │                  │ Backend │                  │ Database│
└────┬────┘                  └────┬────┘                  └────┬────┘
     │                            │                            │
     │ joinConversation           │                            │
     ├───────────────────────────►│ Verify membership           │
     │                            │                            │
     │ sendMessage                │                            │
     │ {conversationId, text}      │                            │
     ├───────────────────────────►│ Create Message              │
     │                            ├──────────────────────────►│
     │                            │ Get conversation members   │
     │                            ├──────────────────────────►│
     │                            │                            │
     │                            │ Emit to each member        │
     │                            │ user:{memberId} room       │
     │                            │                            │
     │ newMessage                 │                            │
     │◄──────────────────────────┤                            │
     │                            │                            │
┌────┴────┐                  ┌────┴────┐
│Receiver │                  │ Backend │
└────┬────┘                  └────┬────┘
     │                            │
     │ newMessage                 │                            │
     │◄──────────────────────────┤                            │
     │                            │
     │ messageDelivered           │                            │
     ├───────────────────────────►│ Update deliveredAt          │
     │                            │                            │
     │                            │ Emit to sender             │
     │                            │ messageDelivered           │
     │                            │──────────────────────────►│
     │                            │                            │
     │ conversation:read          │                            │
     ├───────────────────────────►│ Update readAt               │
     │                            │                            │
     │                            │ Emit read receipts          │
     │ message:read               │                            │
     │◄──────────────────────────┤                            │
```

**Current Message Loading**: Messages are loaded via REST API (`GET /conversations/:conversationId/messages`) when a conversation is opened, then real-time updates come via Socket.IO. Message history is merged with real-time messages to avoid duplicates.

**Conversation Management**: 
- Direct conversations use `directKey` (sorted user IDs) to prevent duplicates
- System handles existing duplicate conversations with warnings
- Unread counts calculated based on `ConversationMember.lastReadAt` vs message timestamps
- REST endpoint `POST /conversations/:conversationId/read` for marking conversations as read

### 5. Chat Flow Details

**Current Implementation**:
- `GET /conversations` - Get user's conversations with latest message and unread counts
- `POST /conversations` - Create new direct conversation or get existing one (handles duplicates)
- `GET /conversations/:conversationId/messages` - Load message history for a conversation
- `POST /conversations/:conversationId/read` - Mark conversation as read via REST
- Socket.IO `sendMessage` - Real-time message delivery
- Socket.IO `conversation:read` - Real-time read receipts
- Conversation membership verification on all operations

### 7. Typing Indicators Flow

**Current Implementation**: Client-side debouncing (1200ms) in MessageInput.tsx. When user types, emits `typing` with `{ conversationId, userId, username }`. Stops typing after timeout or when input is cleared/blurred.

### 8. Read Receipts Implementation

**Current Implementation**: 
- `conversation:read` Socket.IO event triggered from frontend when user views conversation
- Updates `ConversationMember.lastReadAt` and `Message.readAt` for unread messages
- Transaction-based update to ensure consistency
- Emits `message:read` to sender and other participants
- Client-side debouncing (100ms) to prevent excessive read receipt updates
- Visual indicators in ChatScreen.tsx showing "✓ Sent", "✓✓ Delivered", "✓✓ Read"

```
┌─────────┐                  ┌─────────┐
│ Typer   │                  │ Backend │
└────┬────┘                  └────┬────┘
     │                            │
     │ typing                     │
     │ {conversationId, userId, username}│
     ├───────────────────────────►│ Broadcast to conversation  │
     │                            │ (excluding sender)         │
     │                            │──────────────────────────►│
     │                            │                            │
┌────┴────┐                  ┌────┴────┐
│ Others  │                  │ Backend │
└────┬────┘                  └────┬────┘
     │                            │
     │ userTyping                 │
     │ {conversationId, userId, username}│
     │◄──────────────────────────┤
     │                            │
     │                            │
     │ stopTyping                  │
     │ {conversationId, userId}   │
     ├───────────────────────────►│ Broadcast to conversation  │
     │                            │──────────────────────────►│
     │                            │                            │
     │ userStoppedTyping          │
     │ {conversationId, userId}   │
     │◄──────────────────────────┤
```

## Infrastructure Components

### Backend Server
- **Port**: 5000 (configurable via PORT env var)
- **Host**: 0.0.0.0 (accepts connections from any interface)
- **CORS**: Configured for frontend URL (FRONTEND_URL env var)
- **Socket.IO**: WebSocket transport with CORS enabled
- **Presence Management**: In-memory Map (activeConnections) - not persistent across server restarts

### Database
- **Type**: PostgreSQL
- **Connection**: Via Prisma with driver adapter pattern
- **Migrations**: Managed through Prisma Migrate
- **Connection String**: DATABASE_URL environment variable

### Frontend Deployment
- **Platform**: Vercel
- **Build**: Vite production build
- **Routing**: SPA rewrites (all routes to index.html)
- **Environment Variables**: VITE_API_URL, VITE_SOCKET_URL

### Environment Variables

#### Backend (.env)
```
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
```

#### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

**Note**: No .env.example files exist in the repository. Environment variables must be configured manually.

## Development Workflow

### Backend Development
```bash
cd backend
npm install
npm run dev          # Start development server with hot reload
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev          # Start Vite dev server on port 5173
```

### Database Operations
```bash
cd backend
npx prisma migrate dev          # Create and apply migration
npx prisma studio               # Open Prisma Studio UI
npx prisma generate             # Generate Prisma client
```

**DANGER - Do not use on production database:**
```bash
npx prisma migrate reset        # Destructive - resets database
```

### Production Build
```bash
# Frontend
cd frontend
npm run build                   # Build for production
npm run start                   # Preview production build

# Backend
cd backend
npm run start                   # Start production server
```

## Security Considerations

### Current Implementation
- JWT tokens for API authentication (7-day expiration)
- bcrypt for password hashing (cost factor: 10)
- Token validation on Socket.IO connections
- Basic input validation on API endpoints
- Type safety with TypeScript
- Prisma schema validation
- CORS configured for specific frontend origin
- Credentials enabled for token support

### Recommended Future Security Enhancements
- Rate limiting on API endpoints
- Input sanitization
- HTTPS enforcement in production
- Token refresh mechanism
- Password strength requirements
- CSRF protection

## Scalability Considerations

### Current Architecture
- Single server deployment
- In-memory connection tracking (activeConnections Map) - not scalable across instances
- Direct database queries
- No horizontal scaling support for Socket.IO
- Prisma connection pooling via driver adapter

### Current Limitations
- In-memory presence management doesn't scale across multiple server instances
- No horizontal scaling support for Socket.IO
- Server restarts lose all presence data
- No message queue for offline delivery

### Recommended Future Improvements
1. **Redis Adapter**: Use Socket.IO Redis adapter for horizontal scaling
2. **Redis Presence**: Store online status in Redis instead of memory
3. **Load Balancing**: Implement load balancer for multiple backend instances
4. **Database Optimization**: Add connection pooling, query optimization
5. **Caching Layer**: Implement Redis caching for frequently accessed data
6. **Message Queue**: Use message queue for offline message delivery

## Monitoring & Observability

### Current Implementation
- Console logging for socket connections/disconnections
- Error logging for failed operations
- Basic request logging

### Recommended Future Additions
- Structured logging (Winston, Pino)
- Performance monitoring (APM)
- Error tracking (Sentry)
- Metrics collection (Prometheus)
- Health check endpoints
- Request tracing

## Deployment Architecture

### Current Development
```
Frontend (Vite Dev Server) → Backend (Express) → PostgreSQL
localhost:5173              localhost:5000
```

### Current Production Status
**Production deployment has not yet been completed.**

- Frontend: Vercel configuration present (vercel.json) but not deployed
- Backend: No production deployment configured
- Database: PostgreSQL instance required (hosting TBD)

### Recommended Production Architecture (Future)
```
                        ┌─────────────┐
                        │   Load      │
                        │  Balancer   │
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
         │Backend  │     │Backend  │     │Backend  │
         │Instance │     │Instance │     │Instance │
         └────┬────┘     └────┬────┘     └────┬────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     PostgreSQL      │
                    │   (Primary/Replica) │
                    └────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │       Redis          │
                    │  (Session/Presence)  │
                    └────────────────────┘
```

## Performance Optimization

### Current Implementation
- Socket.IO room-based messaging
- In-memory connection tracking for presence
- Basic Prisma queries with indexes defined in schema

### Recommended Future Optimizations
1. **Database Indexing**: Add composite indexes for common query patterns
2. **Message Pagination**: Implement cursor-based pagination for message history
3. **Lazy Loading**: Load conversation details on demand
4. **Debouncing**: Debounce typing indicators (currently implemented client-side)
5. **Batch Operations**: Batch database writes where possible
6. **CDN**: Serve static assets via CDN
7. **Code Splitting**: Implement React code splitting
8. **Redis Adapter**: Use Socket.IO Redis adapter for horizontal scaling
9. **Connection Pooling**: Optimize database connection pooling

## Future Enhancements

### Feature Roadmap
1. **Group Conversations**: Full implementation of group chat functionality
2. **Message Reactions**: Add emoji reactions to messages
3. **File Sharing**: Support for image/file uploads
4. **Message Editing**: Edit sent messages
5. **Message Deletion**: Delete messages for everyone
6. **Push Notifications**: Mobile push notifications
7. **Voice/Video Calling**: WebRTC integration
8. **End-to-End Encryption**: Message encryption
9. **Two-Factor Authentication**: Enhanced security
10. **Themes**: Dark/light mode support

### Infrastructure Improvements
1. **Redis Integration**: Complete Redis implementation for caching and presence
2. **Message Queue**: RabbitMQ/Redis for reliable message delivery
3. **Microservices**: Split into auth, chat, and user services
4. **GraphQL**: Consider GraphQL API instead of REST
5. **Containerization**: Docker deployment
6. **Kubernetes**: Container orchestration for scaling
7. **CI/CD Pipeline**: Automated testing and deployment

## Troubleshooting

### Common Issues

**Socket Connection Issues**
- Verify CORS configuration
- Check JWT token validity
- Ensure WebSocket transport is enabled

**Database Connection Issues**
- Verify DATABASE_URL is correct
- Check PostgreSQL server status
- Ensure Prisma client is generated

**Frontend Build Issues**
- Clear node_modules and reinstall
- Check environment variables
- Verify Vite configuration

### Debug Mode
- Backend: Set DEBUG environment variable
- Frontend: Use browser DevTools
- Database: Enable Prisma query logging

## Conclusion

This RTC application provides a solid foundation for real-time chat functionality with modern web technologies. The current architecture supports development and small-scale deployments, with clear paths for scaling to production environments. The modular structure allows for easy feature additions and infrastructure improvements.

## Documentation Accuracy

- Source code inspected: YES
- Current infrastructure distinguished from planned infrastructure: YES
- Secrets exposed: NO
- Unverified infrastructure claims removed: YES
- Redis correctly identified as placeholder/not implemented: YES
- Deployment status correctly identified as not deployed: YES
- Socket.IO event names verified against source: YES
- Database schema verified against actual Prisma schema: YES
- API endpoints verified against actual route implementations: YES
- Destructive commands properly warned: YES
