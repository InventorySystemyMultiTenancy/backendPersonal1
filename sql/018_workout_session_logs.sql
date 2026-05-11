-- Persisted workout execution logs (aluno start/finish + load notes)
CREATE TABLE IF NOT EXISTS public."WorkoutSessionLog" (
  "id" UUID PRIMARY KEY,
  "personalId" UUID NOT NULL,
  "alunoId" UUID NOT NULL,
  "workoutPlanId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkoutSessionLog_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES public."PersonalProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkoutSessionLog_alunoId_fkey"
    FOREIGN KEY ("alunoId") REFERENCES public."Aluno"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkoutSessionLog_workoutPlanId_fkey"
    FOREIGN KEY ("workoutPlanId") REFERENCES public."WorkoutPlan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS public."WorkoutSessionLogItem" (
  "id" UUID PRIMARY KEY,
  "workoutSessionLogId" UUID NOT NULL,
  "exerciseName" TEXT NOT NULL,
  "loadNotes" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkoutSessionLogItem_workoutSessionLogId_fkey"
    FOREIGN KEY ("workoutSessionLogId") REFERENCES public."WorkoutSessionLog"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkoutSessionLog_personalId_idx" ON public."WorkoutSessionLog"("personalId");
CREATE INDEX IF NOT EXISTS "WorkoutSessionLog_alunoId_idx" ON public."WorkoutSessionLog"("alunoId");
CREATE INDEX IF NOT EXISTS "WorkoutSessionLog_workoutPlanId_idx" ON public."WorkoutSessionLog"("workoutPlanId");
CREATE INDEX IF NOT EXISTS "WorkoutSessionLog_startedAt_idx" ON public."WorkoutSessionLog"("startedAt");
CREATE INDEX IF NOT EXISTS "WorkoutSessionLog_finishedAt_idx" ON public."WorkoutSessionLog"("finishedAt");
CREATE INDEX IF NOT EXISTS "WorkoutSessionLogItem_workoutSessionLogId_idx" ON public."WorkoutSessionLogItem"("workoutSessionLogId");
CREATE INDEX IF NOT EXISTS "WorkoutSessionLogItem_orderIndex_idx" ON public."WorkoutSessionLogItem"("orderIndex");
