-- Adds an optional image URL to each student-facing plan.
-- The frontend can upload the image to its storage/CDN and save the returned URL here.

ALTER TABLE IF EXISTS "AlunoPlan"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
