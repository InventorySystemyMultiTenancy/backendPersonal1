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

-- Note: The index on "createdAt" already exists from migration 015_messages.sql
-- It will efficiently support the cleanup queries
