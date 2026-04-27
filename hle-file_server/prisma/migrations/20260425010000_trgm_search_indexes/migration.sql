-- Enable pg_trgm for fast ILIKE search.
-- GIN trigram indexes let Postgres use an index scan for ILIKE '%q%' queries,
-- turning the file-search path from a sequential scan into an index lookup.
-- SCHEMA public is explicit because Prisma sets search_path to the app schema
-- (file_server) only — without this, CREATE EXTENSION lands the operator
-- classes in file_server and the public.gin_trgm_ops reference below fails.
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

CREATE INDEX IF NOT EXISTS "File_name_trgm_idx"         ON file_server."File" USING GIN (name public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "File_originalName_trgm_idx" ON file_server."File" USING GIN ("originalName" public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "File_description_trgm_idx"  ON file_server."File" USING GIN (description public.gin_trgm_ops);
