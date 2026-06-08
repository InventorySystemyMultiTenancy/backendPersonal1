-- Add videoUrl column to WorkoutPlanItem and WorkoutTemplateItem tables
ALTER TABLE public."WorkoutPlanItem"
  ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;

ALTER TABLE public."WorkoutTemplateItem"
  ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
