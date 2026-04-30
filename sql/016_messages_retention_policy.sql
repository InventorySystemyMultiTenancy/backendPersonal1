-- Migration 016: Messages retention policy (delete messages older than 7 days)
-- This prevents the database from filling up with old messages

-- Create a function to delete old messages
CREATE OR REPLACE FUNCTION delete_old_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM "Message"
  WHERE "createdAt" < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create an index for efficient deletion queries
CREATE INDEX IF NOT EXISTS "Message_createdAt_retention_idx" 
ON "Message"("createdAt") 
WHERE "createdAt" < NOW() - INTERVAL '7 days';

-- Optional: Create a trigger to automatically clean up old messages
-- You can schedule this using pg_cron or call it manually via a cron job
-- For now, this function can be called via: SELECT delete_old_messages();
