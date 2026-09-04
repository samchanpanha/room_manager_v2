-- CreateTable
CREATE TABLE "TelegramLinkCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "principalType" TEXT NOT NULL,
    "memberProfileId" TEXT,
    "ownerProfileId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLinkCode_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TelegramLinkCode_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "displayName" TEXT,
    "principalType" TEXT NOT NULL,
    "memberProfileId" TEXT,
    "ownerProfileId" TEXT,
    "userId" TEXT,
    "prefs" TEXT NOT NULL DEFAULT '{}',
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" DATETIME,
    CONSTRAINT "TelegramLink_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TelegramLink_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TelegramLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelegramOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkCode_code_key" ON "TelegramLinkCode"("code");

-- CreateIndex
CREATE INDEX "TelegramLinkCode_principalType_memberProfileId_consumedAt_idx" ON "TelegramLinkCode"("principalType", "memberProfileId", "consumedAt");

-- CreateIndex
CREATE INDEX "TelegramLinkCode_principalType_ownerProfileId_consumedAt_idx" ON "TelegramLinkCode"("principalType", "ownerProfileId", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_chatId_key" ON "TelegramLink"("chatId");

-- CreateIndex
CREATE INDEX "TelegramLink_principalType_memberProfileId_idx" ON "TelegramLink"("principalType", "memberProfileId");

-- CreateIndex
CREATE INDEX "TelegramLink_principalType_ownerProfileId_idx" ON "TelegramLink"("principalType", "ownerProfileId");

-- CreateIndex
CREATE INDEX "TelegramOutbox_chatId_createdAt_idx" ON "TelegramOutbox"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramOutbox_template_createdAt_idx" ON "TelegramOutbox"("template", "createdAt");

