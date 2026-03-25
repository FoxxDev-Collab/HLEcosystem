-- CreateEnum
CREATE TYPE "PageVisibility" AS ENUM ('PRIVATE', 'HOUSEHOLD', 'SHARED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'EDIT');

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "visibility" "PageVisibility" NOT NULL DEFAULT 'HOUSEHOLD',
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "contentText" TEXT NOT NULL DEFAULT '',
    "icon" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageShare" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageComment" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageTag" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "PageTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WikiPage_ownerId_idx" ON "WikiPage"("ownerId");

-- CreateIndex
CREATE INDEX "WikiPage_parentId_idx" ON "WikiPage"("parentId");

-- CreateIndex
CREATE INDEX "WikiPage_visibility_idx" ON "WikiPage"("visibility");

-- CreateIndex
CREATE INDEX "WikiPage_createdBy_idx" ON "WikiPage"("createdBy");

-- CreateIndex
CREATE INDEX "WikiPage_archived_idx" ON "WikiPage"("archived");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_ownerId_parentId_slug_key" ON "WikiPage"("ownerId", "parentId", "slug");

-- CreateIndex
CREATE INDEX "PageShare_householdId_idx" ON "PageShare"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "PageShare_pageId_householdId_key" ON "PageShare"("pageId", "householdId");

-- CreateIndex
CREATE INDEX "PageComment_pageId_idx" ON "PageComment"("pageId");

-- CreateIndex
CREATE INDEX "PageComment_parentId_idx" ON "PageComment"("parentId");

-- CreateIndex
CREATE INDEX "PageTag_tag_idx" ON "PageTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "PageTag_pageId_tag_key" ON "PageTag"("pageId", "tag");

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageShare" ADD CONSTRAINT "PageShare_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageComment" ADD CONSTRAINT "PageComment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageComment" ADD CONSTRAINT "PageComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PageComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageTag" ADD CONSTRAINT "PageTag_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
