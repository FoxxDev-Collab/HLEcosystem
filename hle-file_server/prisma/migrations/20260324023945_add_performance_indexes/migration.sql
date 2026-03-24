-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'DOWNLOAD', 'EDIT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_RENAME', 'FILE_MOVE', 'FILE_COPY', 'FILE_DELETE', 'FILE_RESTORE', 'FILE_PERMANENT_DELETE', 'FILE_TAG_ADD', 'FILE_TAG_REMOVE', 'FILE_SHARE', 'FILE_UNSHARE', 'FILE_SHARE_LINK_CREATE', 'FILE_SHARE_LINK_REVOKE', 'FILE_FAVORITE', 'FILE_UNFAVORITE', 'FOLDER_CREATE', 'FOLDER_RENAME', 'FOLDER_MOVE', 'FOLDER_DELETE', 'FOLDER_RESTORE');

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "parentFolderId" TEXT,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "folderId" TEXT,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentHash" TEXT,
    "thumbnailPath" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVersion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "size" BIGINT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentHash" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileTag" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileShare" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sharedWithUserId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "createdByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxDownloads" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "fileId" TEXT,
    "folderId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageQuota" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "maxStorageBytes" BIGINT NOT NULL DEFAULT 5368709120,
    "usedStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Folder_householdId_idx" ON "Folder"("householdId");

-- CreateIndex
CREATE INDEX "Folder_parentFolderId_idx" ON "Folder"("parentFolderId");

-- CreateIndex
CREATE INDEX "Folder_ownerId_idx" ON "Folder"("ownerId");

-- CreateIndex
CREATE INDEX "Folder_householdId_parentFolderId_ownerId_deletedAt_idx" ON "Folder"("householdId", "parentFolderId", "ownerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_householdId_parentFolderId_name_ownerId_key" ON "Folder"("householdId", "parentFolderId", "name", "ownerId");

-- CreateIndex
CREATE INDEX "File_householdId_idx" ON "File"("householdId");

-- CreateIndex
CREATE INDEX "File_folderId_idx" ON "File"("folderId");

-- CreateIndex
CREATE INDEX "File_householdId_status_idx" ON "File"("householdId", "status");

-- CreateIndex
CREATE INDEX "File_contentHash_idx" ON "File"("contentHash");

-- CreateIndex
CREATE INDEX "File_ownerId_idx" ON "File"("ownerId");

-- CreateIndex
CREATE INDEX "File_deletedAt_idx" ON "File"("deletedAt");

-- CreateIndex
CREATE INDEX "File_householdId_folderId_status_deletedAt_idx" ON "File"("householdId", "folderId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "File_uploadedByUserId_idx" ON "File"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "File_mimeType_idx" ON "File"("mimeType");

-- CreateIndex
CREATE INDEX "FileVersion_fileId_idx" ON "FileVersion"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "FileVersion_fileId_versionNumber_key" ON "FileVersion"("fileId", "versionNumber");

-- CreateIndex
CREATE INDEX "Tag_householdId_idx" ON "Tag"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_householdId_name_key" ON "Tag"("householdId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FileTag_fileId_tagId_key" ON "FileTag"("fileId", "tagId");

-- CreateIndex
CREATE INDEX "FileShare_sharedWithUserId_idx" ON "FileShare"("sharedWithUserId");

-- CreateIndex
CREATE INDEX "FileShare_sharedByUserId_idx" ON "FileShare"("sharedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FileShare_fileId_sharedWithUserId_key" ON "FileShare"("fileId", "sharedWithUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_token_idx" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_fileId_idx" ON "ShareLink"("fileId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_fileId_key" ON "Favorite"("userId", "fileId");

-- CreateIndex
CREATE INDEX "AuditLog_householdId_createdAt_idx" ON "AuditLog"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_fileId_idx" ON "AuditLog"("fileId");

-- CreateIndex
CREATE INDEX "AuditLog_folderId_idx" ON "AuditLog"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageQuota_householdId_key" ON "StorageQuota"("householdId");

-- CreateIndex
CREATE INDEX "StorageQuota_householdId_idx" ON "StorageQuota"("householdId");

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentFolderId_fkey" FOREIGN KEY ("parentFolderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileTag" ADD CONSTRAINT "FileTag_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileTag" ADD CONSTRAINT "FileTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileShare" ADD CONSTRAINT "FileShare_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
