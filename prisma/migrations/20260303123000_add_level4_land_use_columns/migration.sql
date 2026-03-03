ALTER TABLE "public"."ForestPatrimonyLevel4"
ADD COLUMN IF NOT EXISTS "currentLandUseName" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "previousLandUseName" VARCHAR(255);