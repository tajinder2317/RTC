Use this prompt in Codex. It gives it the exact context and tells it to modify the existing project rather than inventing new files.

You are working on my existing RTC real-time chat application.

IMPORTANT: Do NOT create a new Chat.tsx or restructure the project. Work with the existing architecture and files.

## Current project state

Frontend is React + TypeScript + Vite.

Relevant files:

* `frontend/src/features/chat/ConversationList.tsx`
* `frontend/src/features/chat/ChatScreen.tsx`
* `frontend/src/features/chat/chatStore.ts`
* `frontend/src/features/auth/authStore.ts`
* `frontend/src/services/api.ts`
* `frontend/src/services/socket.ts`

Backend is already working for authentication, users, conversations, messages, and Socket.IO.

## Already implemented

`frontend/src/services/api.ts` already contains:

* `getUsers(token)`
* `loginUser(email, password)`
* `createConversation(token, userId)`

The current `ConversationList.tsx` already:

1. Fetches conversations from `GET /conversations`
2. Fetches users with `getUsers(token)`
3. Searches users by username
4. Has a Chat button for each user
5. Calls `createConversation(token, user.id)`
6. Adds the returned conversation to the sidebar
7. Calls `onSelectConversation(conversation)`

Do NOT unnecessarily rewrite this functionality.

## Main task

Finish the complete chat flow:

```text
Search users
    ↓
Click Chat
    ↓
create/get conversation
    ↓
select conversation
    ↓
open ChatScreen
    ↓
load messages
    ↓
join/use Socket.IO conversation
    ↓
send and receive messages in real time
```

The existing project does NOT have `Chat.tsx`.

Use the existing `ChatScreen.tsx` and `chatStore.ts` architecture.

## What you must do

First inspect the existing codebase and understand how:

* `ConversationList` is rendered
* `ChatScreen` is rendered
* `chatStore` works
* authentication state is stored
* Socket.IO is connected
* messages are fetched
* messages are sent

Then make the MINIMUM required changes to make the complete flow work.

### Requirement 1 — User search

Keep the existing user search in `ConversationList.tsx`.

Users should be searchable by username.

Clicking a user should call:

```ts
createConversation(token, user.id)
```

The returned conversation should become the currently selected conversation.

If the conversation already exists, the existing conversation should be opened rather than creating a duplicate.

### Requirement 2 — Selected conversation

Use the existing state/store architecture.

Do NOT introduce a new global architecture.

The selected conversation must contain at least:

```ts
{
  id: string;
  members: ...;
  messages: ...;
}
```

When a user clicks a conversation or starts a new chat, `ChatScreen` must receive/use the correct conversation ID.

### Requirement 3 — ChatScreen

Make sure `ChatScreen.tsx`:

* displays the selected user's username
* knows the current `conversationId`
* loads messages for that conversation
* displays existing messages
* handles an empty conversation correctly
* sends new messages to the correct conversation
* receives real-time messages through the existing Socket.IO setup

Do not break functionality that is already working.

### Requirement 4 — Message loading

Use the existing backend endpoint for conversation messages.

Do not invent a new backend endpoint if one already exists.

The backend currently has the conversation messages route under:

```text
GET /conversations/:conversationId/messages
```

It requires the JWT:

```text
Authorization: Bearer <token>
```

Make sure messages are loaded whenever the selected conversation changes.

Avoid stale messages from the previous conversation.

### Requirement 5 — Real-time messages

Use the existing:

```text
frontend/src/services/socket.ts
```

Do not create another Socket.IO client.

Make sure:

* incoming messages appear in the active conversation
* messages for another conversation do not appear in the wrong chat
* duplicate Socket.IO listeners are not created
* listeners are cleaned up correctly
* the sender's own message is not duplicated if the current architecture already adds it optimistically

### Requirement 6 — Conversation list updates

When a new message arrives:

* update the appropriate conversation's latest message
* move it to the top if that is how the existing UI works
* increment unread count if it is not currently open
* keep unread count at 0 for the active conversation

Do not break the existing unread-count functionality.

### Requirement 7 — Registration auto-login

After the chat flow works, fix registration.

Find the existing registration page/component and registration API.

Current desired behavior:

```text
Register form
    ↓
POST /auth/register
    ↓
successful registration
    ↓
automatically log the user in
    ↓
store token + user in authStore
    ↓
redirect to /chat
```

Do not make the user manually log in after registering.

If the backend registration endpoint already returns a JWT/token and user, use that response directly.

If registration only returns success/user information and does NOT return a token, use the existing `loginUser(email, password)` function immediately after successful registration.

Use the existing `authStore` methods rather than creating another auth system.

After successful authentication:

```ts
navigate("/chat")
```

### Requirement 8 — Authentication persistence

Check the existing `authStore.ts`.

Make sure the token and user are stored in the same way the existing login flow expects.

Do not create duplicate auth stores.

Make sure refreshing `/chat` does not unnecessarily destroy the authenticated state if persistence already exists.

### Requirement 9 — Routing

Do not create a new route if `/chat` already exists.

Verify the existing route configuration.

The final behavior should be:

```text
/login  → successful login → /chat
/register → successful registration → /chat
```

Unauthenticated users should still be handled according to the existing routing/auth architecture.

## Important constraints

1. Do NOT create `Chat.tsx`.
2. Do NOT rewrite the backend unless absolutely necessary.
3. Do NOT replace Socket.IO with another technology.
4. Do NOT create another auth store.
5. Do NOT create duplicate API clients.
6. Do NOT remove working functionality.
7. Prefer small, targeted changes.
8. Preserve the existing TypeScript types where possible.
9. Fix TypeScript errors caused by your changes.
10. Check imports carefully.
11. Use the existing `VITE_API_URL`.
12. Do not hardcode `http://localhost:5000` into new code.
13. Do not use fake/mock data.
14. Do not just explain what should be changed — actually modify the files.
15. After modifying the files, run the frontend TypeScript/build checks available in the project and fix errors.

## Final verification

After making changes, verify this exact scenario:

1. User A logs in.
2. User A opens `/chat`.
3. User A searches for User B.
4. User A clicks Chat.
5. A conversation is created/retrieved.
6. User A's ChatScreen opens.
7. User A can send a message.
8. User B receives it in real time.
9. User B can reply.
10. User A receives the reply in real time.
11. Conversation list updates correctly.
12. Search can start an existing conversation without creating duplicates.
13. User can switch between conversations without seeing messages from the wrong conversation.
14. User registers a new account.
15. Registration automatically authenticates the new user.
16. New user is redirected to `/chat`.

At the end, give me:

* files changed
* what was changed in each file
* any remaining issues
* exact commands to run/test the application

Do not stop after analysis. Inspect the codebase and implement the fixes.
