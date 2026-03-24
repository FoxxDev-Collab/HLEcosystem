-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV_SHOW', 'MUSIC');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'FULFILLED', 'DENIED');

-- CreateTable
CREATE TABLE "MediaRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "year" INTEGER,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "adminNote" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaRequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaRequest_requesterId_idx" ON "MediaRequest"("requesterId");

-- CreateIndex
CREATE INDEX "MediaRequest_status_idx" ON "MediaRequest"("status");

-- CreateIndex
CREATE INDEX "MediaRequestComment_requestId_idx" ON "MediaRequestComment"("requestId");

-- AddForeignKey
ALTER TABLE "MediaRequestComment" ADD CONSTRAINT "MediaRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MediaRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
