-- CreateTable: FileContent
-- All statements use IF NOT EXISTS / exception handling so this migration is
-- safe to re-run if the objects were already created by a manual apply.
CREATE TABLE IF NOT EXISTS file_server."FileContent" (
    "id"          TEXT        NOT NULL,
    "fileId"      TEXT        NOT NULL,
    "rawText"     TEXT,
    "pageCount"   INTEGER,
    "wordCount"   INTEGER,
    "extractedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "FileContent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE file_server."FileContent"
        ADD CONSTRAINT "FileContent_fileId_key" UNIQUE ("fileId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE file_server."FileContent"
        ADD CONSTRAINT "FileContent_fileId_fkey"
        FOREIGN KEY ("fileId") REFERENCES file_server."File"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "FileContent_fileId_idx"
    ON file_server."FileContent" ("fileId");

DO $$ BEGIN
    ALTER TABLE file_server."FileContent"
        ADD COLUMN "searchVector" tsvector
        GENERATED ALWAYS AS (to_tsvector('english', COALESCE("rawText", ''))) STORED;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "FileContent_searchVector_idx"
    ON file_server."FileContent" USING GIN ("searchVector");
