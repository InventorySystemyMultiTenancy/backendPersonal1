-- Minimal bootstrap for Prisma backend when migrations were not applied yet.
-- Creates required enums/tables and inserts initial users/plans.

CREATE SCHEMA IF NOT EXISTS public;

DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'PERSONAL', 'ALUNO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PlanType" AS ENUM ('FREE', 'PRO', 'PREMIUM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."User" (
  "id" UUID PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "personalId" UUID NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS public."PersonalProfile" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL UNIQUE,
  "businessName" TEXT NOT NULL,
  "phone" TEXT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "defaultPlan" "PlanType" NOT NULL DEFAULT 'FREE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES public."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$
BEGIN
  ALTER TABLE public."User"
    ADD CONSTRAINT "User_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES public."PersonalProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "User_role_idx" ON public."User"("role");
CREATE INDEX IF NOT EXISTS "User_personalId_idx" ON public."User"("personalId");
CREATE INDEX IF NOT EXISTS "PersonalProfile_status_idx" ON public."PersonalProfile"("status");

CREATE TABLE IF NOT EXISTS public."SubscriptionPlan" (
  "id" UUID PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT NULL,
  "plan" "PlanType" NOT NULL,
  "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "SubscriptionPlan_isActive_idx" ON public."SubscriptionPlan"("isActive");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_plan_idx" ON public."SubscriptionPlan"("plan");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_sortOrder_idx" ON public."SubscriptionPlan"("sortOrder");

INSERT INTO public."User" ("id","email","passwordHash","role","isActive","personalId","createdAt","updatedAt")
VALUES
('11111111-1111-1111-1111-111111111111','admin@selfmachine.com','$2a$10$NmO.7t3ud9ThJAW6LLGsteXVpM5V214suSSZ0aQKuSfbD.L3O6VWa','SUPER_ADMIN',true,NULL,NOW(),NOW())
ON CONFLICT ("email") DO NOTHING;

INSERT INTO public."SubscriptionPlan" ("id","code","name","plan","interval","priceCents","currency","isActive","sortOrder","createdAt","updatedAt")
VALUES
('22222222-2222-2222-2222-222222222221','FREE','Plano Free','FREE','MONTHLY',0,'BRL',true,1,NOW(),NOW()),
('22222222-2222-2222-2222-222222222222','PRO','Plano Pro','PRO','MONTHLY',9900,'BRL',true,2,NOW(),NOW()),
('22222222-2222-2222-2222-222222222223','PREMIUM','Plano Premium','PREMIUM','MONTHLY',19900,'BRL',true,3,NOW(),NOW())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO public."User" ("id","email","passwordHash","role","isActive","personalId","createdAt","updatedAt")
VALUES
('33333333-3333-3333-3333-333333333333','personal@selfmachine.com','$2a$10$NmO.7t3ud9ThJAW6LLGsteXVpM5V214suSSZ0aQKuSfbD.L3O6VWa','PERSONAL',true,NULL,NOW(),NOW())
ON CONFLICT ("email") DO NOTHING;

INSERT INTO public."PersonalProfile" ("id","userId","businessName","status","defaultPlan","createdAt","updatedAt")
VALUES
('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','Thiago Iazzetti Studio','ACTIVE','PRO',NOW(),NOW())
ON CONFLICT ("userId") DO NOTHING;

UPDATE public."User"
SET "personalId" = '44444444-4444-4444-4444-444444444444',
    "updatedAt" = NOW()
WHERE "id" = '33333333-3333-3333-3333-333333333333';
