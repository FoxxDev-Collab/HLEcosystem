-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ALBUM_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'ALBUM_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'ALBUM_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'ALBUM_ADD_FILE';
ALTER TYPE "AuditAction" ADD VALUE 'ALBUM_REMOVE_FILE';

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverFileId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumFile" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoMetadata" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "dateTaken" TIMESTAMP(3),
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "focalLength" TEXT,
    "aperture" TEXT,
    "shutterSpeed" TEXT,
    "iso" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "orientation" INTEGER,
    "colorSpace" TEXT,
    "hasExif" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarFileId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceTag" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Album_householdId_idx" ON "Album"("householdId");

-- CreateIndex
CREATE INDEX "Album_createdByUserId_idx" ON "Album"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Album_householdId_name_key" ON "Album"("householdId", "name");

-- CreateIndex
CREATE INDEX "AlbumFile_albumId_idx" ON "AlbumFile"("albumId");

-- CreateIndex
CREATE INDEX "AlbumFile_fileId_idx" ON "AlbumFile"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumFile_albumId_fileId_key" ON "AlbumFile"("albumId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoMetadata_fileId_key" ON "PhotoMetadata"("fileId");

-- CreateIndex
CREATE INDEX "PhotoMetadata_dateTaken_idx" ON "PhotoMetadata"("dateTaken");

-- CreateIndex
CREATE INDEX "PhotoMetadata_fileId_idx" ON "PhotoMetadata"("fileId");

-- CreateIndex
CREATE INDEX "Person_householdId_idx" ON "Person"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_householdId_name_key" ON "Person"("householdId", "name");

-- CreateIndex
CREATE INDEX "FaceTag_fileId_idx" ON "FaceTag"("fileId");

-- CreateIndex
CREATE INDEX "FaceTag_personId_idx" ON "FaceTag"("personId");

-- AddForeignKey
ALTER TABLE "AlbumFile" ADD CONSTRAINT "AlbumFile_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumFile" ADD CONSTRAINT "AlbumFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoMetadata" ADD CONSTRAINT "PhotoMetadata_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceTag" ADD CONSTRAINT "FaceTag_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
