# Real-Time Chat (RTC) - Comprehensive Bug Audit & Resolution Plan

This document details all identified bugs, edge cases, security vulnerabilities, and code quality issues across the backend and frontend of the RTC codebase, along with the planned and implemented fixes.

---

## Table of Contents
1. [Critical & Application-Breaking Bugs](#1-critical--application-breaking-bugs)
2. [Realtime, Socket & Presence Issues](#2-realtime-socket--presence-issues)
3. [Security, Authentication & Data Integrity Flaws](#3-security-authentication--data-integrity-flaws)
4. [UI / UX Defects & State Management Issues](#4-ui--ux-defects--state-management-issues)
5. [Code Cleanliness, Dead Code & Dependency Issues](#5-code-cleanliness-dead-code--dependency-issues)
6. [Step-by-Step Implementation Tracker](#6-step-by-step-implementation-tracker)

---

## 1. Critical & Application-Breaking Bugs

### 1.1 Unhandled `JSON.parse` Crash in `authStore.ts`
- **Location:** `frontend/src/features/auth/authStore.ts`
- **Description:** `localStorage.getItem("user")` is directly parsed via `JSON.parse(storedUser)` at module initialization. If the value is `"undefined"`, invalid JSON, or corrupted, it throws an unhandled `SyntaxError`.
- **Impact:** Crashes the entire React app at load time with a blank white screen; users cannot reach `/login` or recover without manually clearing browser storage.
- **Fix:** Wrap in a `try...catch` helper with fallback to `null` and purge invalid storage entries.

### 1.2 Permanent Re-Friending Database Crash (`P2002` Unique Constraint Violation)
- **Location:** `backend/src/friends/friends.routes.ts`
- **Description:** When removing a friend (`DELETE /friends/:userId`), only the `Friendship` row is deleted. The prior `FriendRequest` row remains with `status: "ACCEPTED"`. If either user tries to send a friend request again, `sendFriendRequestHandler` checks for `PENDING` or `REJECTED`, finds `ACCEPTED`, and attempts `prisma.friendRequest.create()`. Because `FriendRequest` has `@@unique([senderId, receiverId])`, Prisma throws `P2002` causing a `500 Internal Server Error`.
- **Impact:** Once un-friended, two users can never send a friend request to each other again.
- **Fix:** In `sendFriendRequestHandler`, if a request in `ACCEPTED` status already exists between the users (and they are not currently friends), update it back to `PENDING` instead of attempting to create a duplicate. Also ensure `DELETE /friends/:userId` resets or cleans up associated friend request records.

### 1.3 New Conversations Dropped in Sidebar on First Message
- **Location:** `frontend/src/features/chat/ConversationList.tsx`
- **Description:** In `handleNewMessage`, it checks `previous.find(c => c.id === message.conversationId)`. If `existing` is undefined (a brand new conversation created by another user), it executes `if (!existing) return previous;`.
- **Impact:** The recipient never sees the new conversation in their sidebar until performing a full page reload.
- **Fix:** When a new message arrives for an unrecognized conversation, fetch the conversation details or reload conversations.

### 1.4 Silent Message Loss on Send
- **Location:** `frontend/src/features/chat/MessageInput.tsx`, `frontend/src/features/chat/ChatScreen.tsx`
- **Description:** `MessageInput` wipes the textarea (`setText("")`) immediately upon form submit. If `socket.connected` is false (e.g. during a brief reconnect) or `currentUser` is null, `ChatScreen.sendMessage` drops the text silently.
- **Impact:** User's typed message is permanently erased from the input with zero feedback or ability to recover the text.
- **Fix:** Only clear textarea if sending succeeded or keep draft on failed send; show visual status if socket is disconnected.

### 1.5 Bypassed API URL Fallback Causes Broken Network Requests
- **Location:** `frontend/src/features/chat/ConversationList.tsx`, `frontend/src/features/chat/ChatScreen.tsx`
- **Description:** Direct `fetch(`${import.meta.env.VITE_API_URL}/...`)` calls bypass `API_URL` defined in `services/api.ts`. If `VITE_API_URL` is omitted, requests go to `"undefined/conversations"`.
- **Impact:** 404 and network errors in environments without explicit `.env` injection.
- **Fix:** Import and use `API_URL` or exported helper methods from `services/api.ts`.

---

## 2. Realtime, Socket & Presence Issues

### 2.1 Socket Disconnection on Every Page Transition
- **Location:** `frontend/src/app/ProtectedRoute.tsx`, `frontend/src/app/navigation.tsx`
- **Description:** Each route (`/chat`, `/friends`) is wrapped in its own `<ProtectedRoute>`. Navigating between routes unmounts the previous route, triggering `disconnectSocket()`, followed immediately by `connectSocket(token)`.
- **Impact:** High socket churn, reconnection delays, and repeated fake `userOffline`/`userOnline` broadcasts to all connected friends.
- **Fix:** Manage socket connection in a shared top-level layout / provider tied to the authentication token, not per-route mount/unmount.

### 2.2 Stale Socket Auth Identity Across Logins
- **Location:** `frontend/src/services/socket.ts`
- **Description:** `connectSocket(token)` only calls `socket.connect()` if `!socket.connected`. If User A logs out and User B logs in without a full browser reload, the socket remains active with User A's token.
- **Impact:** User B receives User A's private messages and realtime events.
- **Fix:** If the socket is already connected with a different token, disconnect it and reconnect with the new token.

### 2.3 Offline Messages Never Marked Delivered
- **Location:** `backend/src/chat/chat.socket.ts`, `frontend/src/features/chat/chatStore.ts`
- **Description:** `messageDelivered` is only emitted in `socket.on("newMessage")`. Messages delivered while a user was offline are fetched via REST (`GET /messages/:conversationId`), but are never marked delivered.
- **Impact:** Messages sent to offline users permanently show single checkmark `✓` until read.
- **Fix:** Emit delivery confirmation for un-delivered messages when fetched or loaded.

### 2.4 Stuck Typing Indicator on Disconnect
- **Location:** `backend/src/chat/chat.socket.ts`, `frontend/src/features/chat/ChatScreen.tsx`
- **Description:** If a typing user abruptly closes the tab, no `stopTyping` event is emitted. The receiver also has no receiver-side timeout.
- **Impact:** "... is typing" remains on screen indefinitely.
- **Fix:** Add a client-side timeout (e.g. 3-4s) on `typingUser` in `ChatScreen.tsx` and emit stop typing on backend socket disconnect.

### 2.5 Duplicate Presence Event Emissions
- **Location:** `backend/src/chat/chat.socket.ts`, `frontend/src/features/presence/presenceStore.ts`
- **Description:** The server emits both `presence:online` and `userOnline`, `presence:offline` and `userOffline`, `presence:state` and `onlineUsers`. The frontend registers listeners for all of them.
- **Impact:** Double re-renders and unnecessary event handlers.
- **Fix:** Consolidate onto the standard `presence:*` events and remove redundant legacy events.

---

## 3. Security, Authentication & Data Integrity Flaws

### 3.1 Plaintext Database Credentials & Weak Secret in Repository
- **Location:** `backend/.env`
- **Description:** Neon database connection string with plaintext credentials and a weak JWT secret (`SecretKey1000`) are stored in `.env`.
- **Fix:** Secure `.env.example`, ensure `.env` is gitignored, and document credential rotation.

### 3.2 Authorization Bypass on `messageDelivered` Socket Event
- **Location:** `backend/src/chat/chat.socket.ts`
- **Description:** Any socket can emit `messageDelivered` with any `messageId`, and the server marks it delivered without checking if the user is a member of that conversation.
- **Fix:** Verify conversation membership before updating delivery status.

### 3.3 REST Message Endpoint Fails to Broadcast via Socket
- **Location:** `backend/src/messages/messages.routes.ts`
- **Description:** `POST /messages/:conversationId` inserts message in database but never emits `newMessage` to conversation members.
- **Fix:** Share `io` instance with messages route and emit `newMessage` to members.

### 3.4 Email Case-Sensitivity Causes Login Failures
- **Location:** `backend/src/auth/auth.routes.ts`
- **Description:** Emails are stored and queried without `.toLowerCase().trim()`.
- **Impact:** Registering as `User@example.com` and logging in as `user@example.com` fails.
- **Fix:** Normalize all email inputs to lowercase and trimmed strings on register and login.

### 3.5 Missing Auth `/me` Response Fields
- **Location:** `backend/src/auth/auth.routes.ts`
- **Description:** `/auth/me` returns `{ userId, username }`, missing `email` and using `userId` instead of `id`. Frontend expects `{ id, username, email }`.
- **Fix:** Fetch and return the full user object `{ id, username, email }`.

---

## 4. UI / UX Defects & State Management Issues

### 4.1 Hardcoded Developer Username in Sidebar
- **Location:** `frontend/src/features/chat/ConversationList.tsx`
- **Description:** Lines 496-502 hardcode `user.username === "dhillon2317"` for a "Quick chat" widget, and lines 1088-1098 display `"User dhillon2317 not found"`.
- **Fix:** Remove hardcoded test username and replace with dynamic contacts / recent chats or remove widget.

### 4.2 Missing Logout Button in UI
- **Location:** `frontend/src/features/chat/ChatScreen.tsx`, `frontend/src/features/friends/Friends.tsx`
- **Description:** `logout()` exists in `authStore.ts` but is never rendered anywhere in the application.
- **Fix:** Add a clean Logout button to the header in both Chat and Friends views.

### 4.3 Chat History Scroll Hijacking
- **Location:** `frontend/src/features/chat/ChatMessages.tsx`
- **Description:** `useEffect` triggers `scrollIntoView` whenever `messages` reference changes. Receipt updates (`readAt`, `deliveredAt`) update `messages`, forcibly snapping users back to the bottom when they scroll up.
- **Fix:** Only auto-scroll on new incoming/outgoing messages if the user is already near the bottom, or on initial load / conversation switch.

### 4.4 Friend Request Double-Click Race Condition
- **Location:** `frontend/src/features/friends/FriendRequests.tsx`, `FriendList.tsx`
- **Description:** Accept, Reject, and Remove buttons lack disabled states during API calls.
- **Fix:** Pass down action loading state and disable buttons during execution.

### 4.5 Theme Synchronization Flaw
- **Location:** `frontend/src/features/chat/ChatScreen.tsx`, `frontend/src/features/friends/Friends.tsx`, `frontend/src/features/auth/useAuthTheme.ts`
- **Description:** `useAuthTheme` toggles `document.documentElement.classList.contains("dark")`, but `ChatScreen` and `Friends` maintain separate local state and do not update document classList.
- **Fix:** Unify theme handling to synchronize with document root and `localStorage`.

---

## 5. Code Cleanliness, Dead Code & Dependency Issues

### 5.1 Ten 0-Byte Empty Files
- `backend/redis/redis.service.ts`
- `frontend/src/types/user.ts`
- `frontend/src/types/conversation.ts`
- `frontend/src/types/message.ts`
- `frontend/src/utils/formatDate.ts`
- `frontend/src/components/common/Button.tsx`
- `frontend/src/components/common/Input.tsx`
- `frontend/src/components/common/Loading.tsx`
- `frontend/src/features/chat/Message.tsx`
- `frontend/src/features/profile/UserSettings.tsx`
- **Fix:** Implement or cleanly populate canonical types/utilities, and remove or implement empty component stubs.

### 5.2 Duplicate Components & Dead Code
- `MessageBubble` defined twice (`ChatMessages.tsx` and standalone `MessageBubble.tsx`).
- `ChatHeader.tsx` is completely unused because `ChatScreen.tsx` duplicates header markup.
- `express` and server `socket.io` erroneously declared in `frontend/package.json`.
- **Fix:** Consolidate `MessageBubble`, use `ChatHeader`, and prune frontend dependencies.

---

## 6. Step-by-Step Implementation Tracker

- [ ] **Step 1:** Fix critical auth store crash and safe storage parsing (`authStore.ts`).
- [ ] **Step 2:** Fix backend email normalization, `/auth/me` user shape, and message length validation.
- [ ] **Step 3:** Fix backend friend request P2002 database unique constraint crash on re-friending.
- [ ] **Step 4:** Fix socket lifecycle & identity: fix `connectSocket`, remove per-route socket destruction in `ProtectedRoute`.
- [ ] **Step 5:** Fix sidebar dropping new conversations in `handleNewMessage` & remove hardcoded `"dhillon2317"`.
- [ ] **Step 6:** Fix message input draft loss on send & API URL fallbacks.
- [ ] **Step 7:** Add Logout button to navigation headers & tie `logout` to socket and state cleanup.
- [ ] **Step 8:** Fix typing indicator stuck state & chat auto-scroll hijacking.
- [ ] **Step 9:** Clean up types, 0-byte files, and duplicate components.
- [ ] **Step 10:** Verify backend and frontend builds and test execution.
