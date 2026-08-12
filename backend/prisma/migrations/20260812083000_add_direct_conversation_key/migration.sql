-- Add a stable key for direct conversations so the backend can enforce
-- one conversation per user pair without affecting group chats.
ALTER TABLE "Conversation"
ADD COLUMN "directKey" TEXT;

CREATE UNIQUE INDEX "Conversation_directKey_key"
ON "Conversation"("directKey");
