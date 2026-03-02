ALTER TABLE "LandUseType"
ADD COLUMN "category" VARCHAR(150);

UPDATE "LandUseType"
SET "category" = COALESCE(NULLIF(TRIM("name"), ''), 'NO BOSQUE');

ALTER TABLE "LandUseType"
ALTER COLUMN "category" SET NOT NULL;
