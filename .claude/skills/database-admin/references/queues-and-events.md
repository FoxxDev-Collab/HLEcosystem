# Queues and Events

## The core primitive: SKIP LOCKED

`SELECT ... FOR UPDATE SKIP LOCKED` (9.5+) gives you a lock-free, deadlock-free queue primitive.

```sql
-- Worker claims the next available job atomically
UPDATE jobs
SET status = 'running', started_at = now(), worker_id = $1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending' AND run_at <= now()
  ORDER BY run_at, id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

A basic `jobs` table handles 1–10k jobs/s easily. Specialized extensions push past 30k/s.

## Minimal jobs table

```sql
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  kind         text NOT NULL,
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending',  -- pending, running, done, failed, dead
  run_at       timestamptz NOT NULL DEFAULT now(),
  attempts     int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error   text,
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The index that makes SKIP LOCKED fast
CREATE INDEX idx_jobs_pending ON jobs (run_at, id)
  WHERE status = 'pending';
```

The **partial index on `status='pending'`** is critical. Without it, workers scan dead+done rows.

## LISTEN / NOTIFY

Pub/sub without polling.

```sql
-- Publisher
NOTIFY jobs_channel, 'new_job';

-- Consumer (client-side)
LISTEN jobs_channel;
-- Then poll for notifications on the connection
```

Limits to know:
- Payload is **text only, max 8000 bytes**. Send an ID, fetch the row.
- `NOTIFY` takes a global commit-time lock. Under very high write load this serializes.
- Notifications are **delivered to connected listeners only**. If nobody's listening, it's gone. Always back with a persistent jobs table.
- Doesn't survive replication failover pre-PG 17.

Hybrid pattern: INSERT job row + NOTIFY. Workers LISTEN + poll as fallback.

```sql
CREATE OR REPLACE FUNCTION notify_new_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('jobs_channel', NEW.id::text);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_jobs_notify AFTER INSERT ON jobs
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_new_job();
```

## Scheduled jobs: pg_cron

Runs SQL on a cron schedule inside Postgres. Supported on RDS, Aurora, Supabase, Neon.

```sql
CREATE EXTENSION pg_cron;

-- Every 5 minutes
SELECT cron.schedule('cleanup-expired', '*/5 * * * *',
  $$ DELETE FROM sessions WHERE expires_at < now() $$);

-- Every Sunday 3 AM
SELECT cron.schedule('weekly-vacuum', '0 3 * * 0',
  $$ VACUUM ANALYZE events $$);

-- List jobs
SELECT * FROM cron.job;

-- Unschedule
SELECT cron.unschedule('cleanup-expired');
```

## Library selection

| Library | Language | Notes |
|---|---|---|
| **PGMQ** | Any (SQL API) | Tembo, ~30k msg/s, SQS-like semantics |
| **River** | Go | Active, typed jobs, periodic jobs, nice API |
| **Graphile Worker** | Node.js | Mature, used in production heavily |
| **Oban** | Elixir | Best-in-class if you're already on Elixir |
| **Solid Queue** | Rails 8+ | Default ActiveJob backend since Rails 8 |
| **neoq** | Go | Queue-agnostic (Postgres, Redis, in-memory) |

Don't roll your own unless you know why.

## When to graduate past Postgres

Move to Kafka / SQS / RabbitMQ / NATS when:

- Sustained **>50–100k msg/s** for extended periods
- Messages are **large** (MB+) and need replay
- You need **cross-organizational decoupling** (another team consumes)
- You need **complex routing** (topics, partitions, consumer groups, dead-letter exchanges) beyond what SQL makes natural
- You specifically need Kafka's **log-retention semantics** (replay a week of events)

Not because Postgres can't. Because you finally have a reason to decouple.

## Anti-patterns

- **Polling every 100ms without NOTIFY.** Use NOTIFY to wake workers, poll as fallback.
- **Forgetting `ORDER BY` in the SKIP LOCKED query.** Without it, row order is undefined and tail latency grows.
- **`DELETE` vs `UPDATE status='done'`.** DELETE is cheaper if you don't need history. If you do, move to an archive table periodically.
- **Long transactions around job processing.** A 5-minute job should mark itself `running`, commit, do the work, then mark `done` in a second transaction. Don't hold a row lock for 5 minutes.
- **Unbounded `attempts`.** Always have a `max_attempts` and a `dead_letter` status or table.
