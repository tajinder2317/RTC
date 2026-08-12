Yep — **typing indicators are done**. The implementation sounds correctly scoped, and both build/type checks pass.

You're now here:

```text
✅ Auth
✅ Registration auto-login
✅ User search
✅ Friends / requests
✅ Conversations
✅ Real-time messaging
✅ Unread counts
✅ Presence
✅ Typing indicators
        ↓
🔵 READ RECEIPTS  ← NEXT
        ↓
🟡 Profiles / avatars
🟡 Notifications
🔴 Security audit
🔴 Deployment
```

### Next: Read receipts

This one is more important than profiles/notifications because it completes the core messaging experience:

```text
You send
   ↓
✓ Sent
   ↓
✓✓ Delivered
   ↓
✓✓ Read
```

I recommend having Codex implement **read receipts only** next, with:

* existing Socket.IO architecture
* no Redis
* no unnecessary new socket client
* no duplicate listeners
* proper conversation authorization
* `readAt`/equivalent message state
* mark messages read when the conversation is opened/active
* real-time read event to the sender
* unread count synchronization
* switching conversations must not mark the wrong conversation as read
* preserve existing message sending and typing behavior

**One important design choice:** don't just make "read" a frontend-only state. The backend should know which messages have been read, otherwise refreshing the page loses the state.

After read receipts pass, I'd stop adding major chat features temporarily and do **security + deployment**. Profiles and notifications can come afterward.

If you're ready, I can give you the exact **Codex prompt for Read Receipts**.



# RTC Chat App — Real-Time Message Read Receipts

Continue from the current `codex.md` project state.

The application currently has:

* React + TypeScript + Vite frontend
* Express + TypeScript + Prisma backend
* JWT authentication
* Registration auto-login
* Protected routes
* User search
* Friends and friend requests
* Conversations
* Real-time messaging with Socket.IO
* Unread counts
* Online/offline presence
* Typing indicators

The existing functionality is working and MUST NOT be broken.

Current verification:

```bash id="8v3a2p"
cd frontend
npm run build
```

PASS.

```bash id="x8v3b1"
cd backend
npx tsc --noEmit
```

PASS.

---

# Goal

Implement reliable **real-time message read receipts**.

The desired lifecycle is:

```text id="7x5rj4"
Message sent
    ↓
✓ Sent
    ↓
Message delivered to recipient
    ↓
✓✓ Delivered
    ↓
Recipient opens/actively views conversation
    ↓
✓✓ Read
```

The read state must be persisted so that refreshing the application does not lose it.

Use the existing Socket.IO architecture for real-time updates.

Do NOT implement notifications, profiles, media, or other new features in this task.

---

# 1. Inspect the existing architecture first

Before changing anything, inspect:

```text id="c2q1st"
backend Prisma schema
backend/src/chat/
backend/src/server.ts
backend/src/chat/chat.socket.ts
backend/src/chat/chat.routes.ts
frontend/src/services/socket.ts
frontend/src/features/chat/ChatScreen.tsx
frontend/src/features/chat/chatStore.ts
frontend/src/features/chat/ConversationList.tsx
frontend/src/features/chat/MessageInput.tsx
frontend/src/features/chat/TypingIndicator.tsx
frontend/src/features/auth/authStore.ts
```

Also inspect the existing message model and conversation/message APIs.

Do NOT assume the exact schema or event names.

Reuse existing architecture wherever possible.

---

# 2. Database / Prisma

Inspect the existing `Message` model.

Add the minimum persistent field required to represent read state.

A simple approach is:

```prisma
readAt DateTime?
```

However, use the existing schema's conventions and choose the smallest appropriate design.

Important:

* `readAt = null` means unread by the recipient
* `readAt != null` means read
* the sender should not be able to arbitrarily mark their own message as read
* read state belongs to the recipient's viewing of the message

If the existing project already has an equivalent field, reuse it instead of adding another.

Create a Prisma migration if required.

Do NOT reset the database.

Do NOT delete existing messages.

---

# 3. Understand the current message ownership

A message currently has:

```text id="h5n2w9"
conversationId
senderId
text
createdAt
```

Determine the recipient from the conversation membership.

Do NOT trust a frontend-provided recipient ID.

The server must determine authorization using:

```text id="3xw7kq"
authenticated user
+
conversation membership
+
message sender
```

---

# 4. Read receipt event

Use the existing Socket.IO architecture.

Create a clear event such as:

```text id="5k8s2p"
message:read
```

or follow the project's existing naming convention.

The event should communicate enough information for the sender's UI to update.

For example:

```ts id="w8v7cc"
{
  conversationId: string;
  messageId: string;
  readAt: string;
  readBy: string;
}
```

Do not expose unnecessary private information.

---

# 5. Mark messages as read

When a user opens a conversation or becomes actively viewing it:

```text id="5g2j9v"
ChatScreen opens conversation
        ↓
determine unread incoming messages
        ↓
mark them as read
        ↓
persist readAt
        ↓
emit message:read
```

Only mark messages as read when:

* the authenticated user belongs to the conversation
* the message was sent by someone else
* the message is actually unread

Do NOT mark messages sent by the current user as "read by themselves."

---

# 6. Avoid unnecessary database writes

Do not update every message repeatedly.

Only update messages where:

```text id="r3f5m8"
senderId != currentUserId
AND
readAt IS NULL
```

Use a transaction or efficient bulk update where appropriate.

Avoid:

```text id="a6k8p1"
UPDATE message
SET readAt = ...
```

for messages that are already read.

---

# 7. Real-time behavior

When User B reads User A's messages:

```text id="q2z7r4"
User B
   ↓
mark messages read
   ↓
Backend
   ↓
message:read
   ↓
User A
   ↓
UI changes:
✓✓
```

The sender should see the change without refreshing.

Do not require polling.

Do not create a new Socket.IO connection.

---

# 8. Read only the active conversation

This is REQUIRED.

Suppose:

```text id="8w9m2d"
User A is viewing conversation with B
```

and User A also has unread messages from C.

Only B's conversation should be marked read.

Do NOT mark all conversations read when `/chat` opens.

Correct:

```text id="r4n7f2"
Active conversation B
    ↓
mark B's unread messages as read
```

Incorrect:

```text id="v9m3x1"
Open /chat
    ↓
mark every conversation as read
```

---

# 9. Switching conversations

Handle:

```text id="y6j2c8"
A → B
```

then:

```text id="p8s4d1"
B → C
```

correctly.

When switching:

* previous conversation must stop being considered active
* new conversation becomes active
* only the new conversation's unread messages are marked read
* no stale read events should affect the wrong conversation
* existing message history must remain correct

Do not leave stale Socket.IO listeners.

---

# 10. Unread count integration

The existing unread-count system must remain correct.

When messages are marked read:

```text id="n7c3f6"
unreadCount
    ↓
decrease appropriately
```

If all incoming unread messages in the active conversation are marked read:

```text id="m1r9x4"
unreadCount = 0
```

The conversation list should update immediately.

Do not reset unread counts for unrelated conversations.

Do not break the existing real-time unread behavior.

---

# 11. Message UI

Inspect the current message bubble UI.

For messages sent by the current user, show a simple status:

```text id="j4w6p8"
✓   Sent
✓✓  Read
```

If the existing architecture already supports delivery state, preserve it.

If there is no true delivery state yet, do NOT fake a separate delivery protocol just for this task.

In that case, implement:

```text id="s6t2n9"
✓   Sent
✓✓  Read
```

with the second state appearing once the recipient has actually read the message.

Keep the UI simple.

Do not redesign the message bubbles.

---

# 12. Persisted state after refresh

This is REQUIRED.

Scenario:

```text id="w2q8f5"
A sends message
B reads message
B refreshes
```

The message must remain read.

Also:

```text id="f5m7k2"
A refreshes
```

A should still see the appropriate read status based on persisted backend state.

Do not store read state only in Zustand/local state.

---

# 13. Real-time late-arrival handling

Consider this scenario:

```text id="c7p4x9"
B opens conversation
A sends message
message arrives while B is actively viewing
```

The new incoming message should be marked read appropriately because B is already viewing the conversation.

Do not require B to leave and reopen the conversation.

The backend should receive the appropriate read operation for the active conversation.

Avoid excessive read requests for every message if several arrive together.

---

# 14. Existing Socket.IO architecture

Reuse:

```text id="m8r3v7"
frontend/src/services/socket.ts
```

and the existing backend Socket.IO setup.

Do NOT:

* create another Socket.IO client
* create another connection
* replace Socket.IO
* create Redis
* create a polling system
* create a second messaging architecture

Keep listener registration centralized where the current architecture expects it.

Clean up listeners properly.

---

# 15. Backend authorization

The read-receipt operation MUST verify conversation membership.

A malicious user must not be able to send:

```json id="2t7n4c"
{
  "conversationId": "someone-elses-conversation",
  "messageId": "someone-elses-message"
}
```

and mark another user's message as read.

The server must verify:

```text id="b4m8q2"
authenticated user
        ↓
is conversation member?
        ↓
yes
        ↓
is message in conversation?
        ↓
yes
        ↓
was message sent by someone else?
        ↓
yes
        ↓
mark read
```

Otherwise reject the operation.

---

# 16. Do not trust client timestamps

If `readAt` is stored, the backend should generate the timestamp.

Do not trust:

```text id="k8q5v3"
readAt
```

sent from the browser.

Use the server's current time.

---

# 17. Multiple messages

If a conversation has:

```text id="p7x3n9"
Message 1 unread
Message 2 unread
Message 3 unread
```

and the user opens the conversation:

All applicable incoming unread messages should become read.

Do not require the frontend to emit three separate expensive requests unless the current architecture strongly requires it.

Prefer an operation that can mark the appropriate unread messages in bulk.

---

# 18. Socket event payloads

Keep payloads minimal.

For a bulk read operation, you may emit:

```ts id="d4q8w2"
{
  conversationId: string;
  messageIds: string[];
  readAt: string;
}
```

or an equivalent compact structure.

Choose whichever best matches the current architecture.

The frontend should update only the affected messages.

---

# 19. Chat store integration

Inspect `chatStore.ts`.

Keep presence and typing separate from message state as they currently are.

Read receipts may be represented as message state, but do not create unnecessary duplicated state.

Prefer updating the existing message objects.

Do not rewrite `chatStore.ts` unless necessary.

---

# 20. Conversation list integration

If the conversation list uses the latest message, do not break it.

Read receipts should NOT change:

```text id="u5m8r2"
last message
conversation ordering
```

unless the existing UI intentionally does so.

Only update unread/read-related state.

---

# 21. Typing regression

The existing typing indicator must continue working:

```text id="g8p4v1"
typing:start
typing:stop
```

Read receipt events must not interfere with typing events.

Do not modify typing logic unless required for a small integration fix.

---

# 22. Presence regression

The existing presence system must continue working.

Do not change:

```text id="z4m6p8"
presence:online
presence:offline
presence:state
```

unless absolutely necessary.

Presence must remain isolated from read receipts.

---

# 23. Error handling

If marking messages read fails:

* do not crash ChatScreen
* do not prevent message sending
* do not break message loading
* log the technical error appropriately
* keep the UI usable

Read receipts are an enhancement, not a dependency for messaging.

---

# 24. Testing

First inspect whether a test framework already exists.

If there is no test framework:

DO NOT add a large test framework just for this task.

Perform focused manual testing instead.

If a test framework already exists, add tests for:

### Backend

* authenticated member can mark messages read
* non-member cannot mark messages read
* sender cannot mark their own message as read
* already-read messages are not unnecessarily rewritten
* only messages in the active conversation are affected
* server generates `readAt`
* real-time `message:read` event is emitted

### Frontend

* opening a conversation marks appropriate messages read
* read event updates sender UI
* switching conversations does not mark the wrong conversation read
* unread count becomes correct
* listeners are cleaned up
* refresh preserves read state

---

# 25. Manual verification

Use two accounts:

```text id="q8m2v6"
User A
User B
```

## Test 1 — basic read receipt

```text id="h4p7z1"
A opens chat with B
A sends "Hello"

B opens the conversation

A should eventually see:

✓✓ Read
```

## Test 2 — unread message

```text id="w9k3c5"
A sends message
B does NOT open conversation

A must NOT see Read
```

## Test 3 — refresh

```text id="t6r8n2"
B reads A's message
B refreshes

Message remains read.
```

## Test 4 — switching conversations

```text id="p5m7x4"
A has:
Conversation B
Conversation C

C has unread messages.

A opens B.

C must remain unread.
```

## Test 5 — multiple messages

```text id="n3q8w6"
A sends 5 messages while B is away.

B opens the conversation.

All 5 incoming messages become read.
```

## Test 6 — active conversation

```text id="v7k2m9"
B is already viewing A's conversation.

A sends a new message.

The new message should become read appropriately without B reopening the conversation.
```

## Test 7 — authorization

Attempt to make one user mark another user's conversation/message as read.

The backend must reject it.

## Test 8 — regression

Verify:

```text id="s4j8p2"
Registration
Login
Auto-login
Friends
Friend requests
Presence
Typing
Conversation creation
Message history
Send message
Receive message
Unread counts
```

all still work.

---

# 26. Database migration safety

If Prisma schema changes are required:

* create a normal migration
* do NOT reset the database
* do NOT delete existing data
* verify existing messages remain accessible

Use the project's current Prisma migration workflow.

---

# 27. Build and verification

Run:

```bash id="m3q7v8"
cd frontend
npm run build
```

Then:

```bash id="f8k2n5"
cd backend
npx tsc --noEmit
```

If tests already exist, run them.

Fix all TypeScript/build/test errors.

---

# 28. Final report

When finished, report:

```text id="q4n8m2"
Read receipt implementation:
- ...

Database changes:
- ...

Backend files changed:
- ...

Frontend files changed:
- ...

Socket events:
- ...

Authorization:
- ...

Unread count integration:
- ...

Message UI:
- ...

Persistence after refresh:
- ...

Multiple-message handling:
- ...

Tests/manual verification:
- ...

Frontend build: PASS/FAIL
Backend typecheck: PASS/FAIL

Remaining issues:
- ...
```

# Critical constraints

* Do NOT create `Chat.tsx`
* Do NOT replace Socket.IO
* Do NOT create another Socket.IO client
* Do NOT create another auth store
* Do NOT add Redis
* Do NOT add polling
* Do NOT add notifications
* Do NOT add profiles/avatars
* Do NOT implement media
* Do NOT rewrite the chat architecture
* Do NOT break presence
* Do NOT break typing indicators
* Do NOT break unread counts
* Do NOT mark unrelated conversations as read
* Do NOT trust client-provided user IDs for authorization
* Do NOT trust client-provided timestamps
* Keep changes small and targeted

Inspect the existing codebase first, then implement the read-receipt system directly in the repository.
