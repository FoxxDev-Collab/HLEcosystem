-- CreateTable AlbumShareLink
CREATE TABLE "AlbumShareLink" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlbumShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlbumShareLink_token_key" ON "AlbumShareLink"("token");
CREATE INDEX "AlbumShareLink_albumId_idx" ON "AlbumShareLink"("albumId");

ALTER TABLE "AlbumShareLink" ADD CONSTRAINT "AlbumShareLink_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
