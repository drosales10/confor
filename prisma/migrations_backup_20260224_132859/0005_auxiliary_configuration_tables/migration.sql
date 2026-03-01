DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImaClassification') THEN
    CREATE TYPE "ImaClassification" AS ENUM ('I', 'II', 'III', 'IV', 'V');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VegetalMaterialType') THEN
    CREATE TYPE "VegetalMaterialType" AS ENUM ('PURA', 'HIBRIDA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlantType') THEN
    CREATE TYPE "PlantType" AS ENUM ('PROGENIE', 'CLON', 'INJERTO', 'IN_VITRO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlantOrigin') THEN
    CREATE TYPE "PlantOrigin" AS ENUM ('NATIVA', 'EXOTICA', 'NATURALIZADA', 'INTRODUCIDA', 'ENDEMICA', 'CULTIVADA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommunityType') THEN
    CREATE TYPE "CommunityType" AS ENUM ('COMUNA', 'TERRITORIO_INDIGENA', 'COMUNIDAD_CRIOLLA', 'PARROQUIA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecommendedHarvestType') THEN
    CREATE TYPE "RecommendedHarvestType" AS ENUM ('MECANIZADA', 'MANUAL');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "ManagementScheme" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ForestInventoryTypeCatalog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ImaClass" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "classification" "ImaClassification" NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "rangeMin" NUMERIC(12,4),
  "rangeMax" NUMERIC(12,4),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Continent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(20) NOT NULL UNIQUE,
  "name" VARCHAR(120) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Country" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "continentId" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_country_continent"
    FOREIGN KEY ("continentId") REFERENCES "Continent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_country_continent_code" UNIQUE ("continentId", "code")
);

CREATE TABLE IF NOT EXISTS "Region" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "countryId" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_region_country"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_region_country_code" UNIQUE ("countryId", "code")
);

CREATE TABLE IF NOT EXISTS "StateDepartment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "countryId" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_state_country"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_state_country_code" UNIQUE ("countryId", "code")
);

CREATE TABLE IF NOT EXISTS "MunicipalityDistrict" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stateId" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_municipality_state"
    FOREIGN KEY ("stateId") REFERENCES "StateDepartment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_municipality_state_code" UNIQUE ("stateId", "code")
);

CREATE TABLE IF NOT EXISTS "City" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "municipalityId" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_city_municipality"
    FOREIGN KEY ("municipalityId") REFERENCES "MunicipalityDistrict"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_city_municipality_code" UNIQUE ("municipalityId", "code")
);

CREATE TABLE IF NOT EXISTS "CommunityTerritory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "cityId" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "type" "CommunityType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_community_city"
    FOREIGN KEY ("cityId") REFERENCES "City"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_community_city_code" UNIQUE ("cityId", "code")
);

CREATE TABLE IF NOT EXISTS "Species" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "scientificName" VARCHAR(255) NOT NULL,
  "commonName" VARCHAR(255),
  "genus" VARCHAR(120),
  "family" VARCHAR(120),
  "taxonomicOrder" VARCHAR(120),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Provenance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "countryId" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_provenance_country"
    FOREIGN KEY ("countryId") REFERENCES "Country"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "uq_provenance_country_code" UNIQUE ("countryId", "code")
);

CREATE TABLE IF NOT EXISTS "VegetalMaterial" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "speciesId" UUID NOT NULL,
  "materialType" "VegetalMaterialType" NOT NULL,
  "plantType" "PlantType" NOT NULL,
  "plantOrigin" "PlantOrigin" NOT NULL,
  "provenanceId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_vegetal_material_species"
    FOREIGN KEY ("speciesId") REFERENCES "Species"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "fk_vegetal_material_provenance"
    FOREIGN KEY ("provenanceId") REFERENCES "Provenance"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LandUseType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "continentId" UUID,
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(150) NOT NULL,
  "isProductive" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_land_use_continent"
    FOREIGN KEY ("continentId") REFERENCES "Continent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Spacing" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(150) NOT NULL,
  "description" VARCHAR(255),
  "betweenRowsM" NUMERIC(12,4),
  "betweenTreesM" NUMERIC(12,4),
  "treeDensityPerHa" NUMERIC(12,0),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PlantationDirection" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(150) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AccountingDocument" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "documentNumber" VARCHAR(80) NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "bookValueUsd" NUMERIC(18,2) NOT NULL,
  "bookValuePerHaUsd" NUMERIC(18,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Level4AdministrativeCost" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "level4Id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "plantationAreaHa" NUMERIC(12,2) NOT NULL,
  "rotationPhase" VARCHAR(120),
  "accountingDocumentId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_level4_cost_accounting_document"
    FOREIGN KEY ("accountingDocumentId") REFERENCES "AccountingDocument"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "uq_level4_cost_level4_code" UNIQUE ("level4Id", "code")
);

DO $$
BEGIN
  IF to_regclass('public."ForestPatrimonyLevel4"') IS NOT NULL THEN
    ALTER TABLE "Level4AdministrativeCost"
      DROP CONSTRAINT IF EXISTS "fk_level4_cost_level4";

    ALTER TABLE "Level4AdministrativeCost"
      ADD CONSTRAINT "fk_level4_cost_level4"
      FOREIGN KEY ("level4Id") REFERENCES "ForestPatrimonyLevel4"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  ELSIF to_regclass('public.forest_patrimony_level4') IS NOT NULL THEN
    ALTER TABLE "Level4AdministrativeCost"
      DROP CONSTRAINT IF EXISTS "fk_level4_cost_level4";

    ALTER TABLE "Level4AdministrativeCost"
      ADD CONSTRAINT "fk_level4_cost_level4"
      FOREIGN KEY ("level4Id") REFERENCES forest_patrimony_level4(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "ProductType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(150) NOT NULL,
  "minLengthM" NUMERIC(12,4),
  "maxLengthM" NUMERIC(12,4),
  "minSmallEndDiameterCm" NUMERIC(12,4),
  "maxSmallEndDiameterCm" NUMERIC(12,4),
  "recommendedHarvestType" "RecommendedHarvestType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
