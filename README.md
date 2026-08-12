# RTC — Real-Time Chat

A full-stack real-time chat application built with React, Node.js, Express, Socket.IO, Prisma, and PostgreSQL.

## Features

- JWT authentication
- User registration and login
- User discovery
- Friend requests
- Accept/reject friend requests
- Remove friends
- Direct conversations
- Real-time messaging with Socket.IO
- Message history
- Message delivery receipts
- Message read receipts
- Typing indicators
- Conversation management
- PostgreSQL database with Prisma ORM

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- Zustand
- Axios
- Socket.IO Client

### Backend

- Node.js
- Express
- TypeScript
- Socket.IO
- JWT
- bcrypt
- Prisma ORM
- PostgreSQL

### Database

- PostgreSQL
- Prisma migrations

## Project Structure

```text
RTCB/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── conversations/
│   │   ├── friends/
│   │   ├── messages/
│   │   ├── users/
│   │   ├── middleware/
│   │   └── server.ts
│   ├── package.json
│   └── prisma.config.ts
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── .gitignore
└── README.md
```
