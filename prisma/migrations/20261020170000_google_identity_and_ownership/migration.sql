-- Existing browser identities retain LEGACY_ANONYMOUS. Existing private rows
-- retain NULL ownerId and remain quarantined until explicitly attributed.
CREATE TYPE "Role" AS ENUM ('USER', 'OWNER');
CREATE TYPE "IdentityType" AS ENUM ('LEGACY_ANONYMOUS', 'AUTHENTICATED');

ALTER TABLE "User"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "googleSub" TEXT,
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
  ADD COLUMN "identityType" "IdentityType" NOT NULL DEFAULT 'LEGACY_ANONYMOUS';

ALTER TABLE "Watchlist" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Position" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Alert" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Setting"
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "telegramLinkHash" TEXT,
  ADD COLUMN "telegramLinkExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE INDEX "Watchlist_ownerId_idx" ON "Watchlist"("ownerId");
CREATE INDEX "Position_ownerId_idx" ON "Position"("ownerId");
CREATE INDEX "Alert_ownerId_idx" ON "Alert"("ownerId");
CREATE INDEX "Notification_ownerId_idx" ON "Notification"("ownerId");
CREATE UNIQUE INDEX "Setting_ownerId_key" ON "Setting"("ownerId");
-- The quarantined legacy singleton may retain this chat ID while a verified
-- user links it again. Only active per-user settings must be unique.
CREATE UNIQUE INDEX "Setting_owned_telegramChatId_key" ON "Setting"("telegramChatId")
  WHERE "ownerId" IS NOT NULL AND "telegramChatId" IS NOT NULL;
CREATE UNIQUE INDEX "Setting_telegramLinkHash_key" ON "Setting"("telegramLinkHash");

ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An authenticated identity must have a verified Google subject and email.
-- A legacy identity cannot be granted the global OWNER role.
ALTER TABLE "User" ADD CONSTRAINT "User_authenticated_identity_check"
  CHECK ("identityType" <> 'AUTHENTICATED' OR ("email" IS NOT NULL AND "googleSub" IS NOT NULL));
ALTER TABLE "User" ADD CONSTRAINT "User_owner_identity_check"
  CHECK ("role" <> 'OWNER' OR "identityType" = 'AUTHENTICATED');
