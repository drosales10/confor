-- CreateEnum
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION', 'LOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'GITHUB', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_RESET', 'PERMISSION_CHANGE', 'EXPORT', 'VIEW');

-- CreateEnum
CREATE TYPE "ConfigType" AS ENUM ('STRING', 'INTEGER', 'BOOLEAN', 'JSON', 'SECRET');

-- CreateEnum
CREATE TYPE "PatrimonyLevel2Type" AS ENUM ('FINCA', 'PREDIO', 'HATO', 'FUNDO', 'HACIENDA');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('ADQUISICION', 'ARRIENDO', 'USUFRUCTO', 'COMODATO');

-- CreateEnum
CREATE TYPE "PatrimonyLevel3Type" AS ENUM ('COMPARTIMIENTO', 'BLOCK', 'SECCION', 'LOTE', 'ZONA', 'BLOQUE');

-- CreateEnum
CREATE TYPE "PatrimonyLevel4Type" AS ENUM ('RODAL', 'PARCELA', 'ENUMERATION', 'UNIDAD_DE_MANEJO');

-- CreateEnum
CREATE TYPE "PatrimonyLevel5Type" AS ENUM ('REFERENCIA', 'SUBUNIDAD', 'SUBPARCELA', 'MUESTRA', 'SUBMUESTRA');

-- CreateEnum
CREATE TYPE "PlotShapeType" AS ENUM ('RECTANGULAR', 'CUADRADA', 'CIRCULAR', 'HEXAGONAL');

-- CreateEnum
CREATE TYPE "biological_asset_type" AS ENUM ('COMERCIAL', 'INVESTIGACION');

-- CreateEnum
CREATE TYPE "ImaClassification" AS ENUM ('I', 'II', 'III', 'IV', 'V');

-- CreateEnum
CREATE TYPE "VegetalMaterialType" AS ENUM ('PURA', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "PlantType" AS ENUM ('PROGENIE', 'CLON', 'INJERTO', 'IN_VITRO');

-- CreateEnum
CREATE TYPE "PlantOrigin" AS ENUM ('NATIVA', 'EXOTICA', 'NATURALIZADA', 'INTRODUCIDA', 'ENDEMICA', 'CULTIVADA');

-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('COMUNA', 'TERRITORIO_INDIGENA', 'COMUNIDAD_CRIOLLA', 'PARROQUIA');

-- CreateEnum
CREATE TYPE "RecommendedHarvestType" AS ENUM ('MECANIZADA', 'MANUAL');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "logoUrl" VARCHAR(500),
    "countryId" UUID,
    "website" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(100),
    "routePath" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "email" VARCHAR(255) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "username" VARCHAR(100),
    "passwordHash" VARCHAR(255),
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "providerId" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "displayName" VARCHAR(200),
    "avatarUrl" VARCHAR(500),
    "phone" VARCHAR(20),
    "phoneVerifiedAt" TIMESTAMP(3),
    "timezone" VARCHAR(50) DEFAULT 'UTC',
    "locale" VARCHAR(10) DEFAULT 'en',
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(45),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" VARCHAR(255),
    "mfaBackupCodes" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" UUID,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "refreshToken" VARCHAR(255),
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "deviceInfo" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "jobTitle" VARCHAR(150),
    "department" VARCHAR(150),
    "company" VARCHAR(150),
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "country" VARCHAR(100),
    "socialLinks" JSONB,
    "preferences" JSONB,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "data" JSONB,
    "actionUrl" VARCHAR(500),
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "notificationType" VARCHAR(100) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfiguration" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "category" VARCHAR(100) NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "value" TEXT,
    "configType" "ConfigType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "validationRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "SystemConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "userId" UUID,
    "sessionId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(100),
    "entityId" UUID,
    "entityName" VARCHAR(255),
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedFields" TEXT[],
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "requestId" UUID,
    "durationMs" INTEGER,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardWidget" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "componentName" VARCHAR(150) NOT NULL,
    "defaultConfig" JSONB,
    "requiredPermissions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDashboardLayout" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "widgetId" UUID NOT NULL,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 4,
    "height" INTEGER NOT NULL DEFAULT 3,
    "config" JSONB,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDashboardLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "organizationId" UUID,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileUrl" VARCHAR(500),
    "mimeType" VARCHAR(100),
    "fileSize" BIGINT,
    "checksum" VARCHAR(64),
    "entityType" VARCHAR(100),
    "entityId" UUID,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForestPatrimonyLevel2" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "PatrimonyLevel2Type" NOT NULL,
    "legalDocumentDate" TIMESTAMP(3),
    "legalStatus" "LegalStatus",
    "totalAreaHa" DECIMAL(12,2) NOT NULL,
    "centroidLatitude" DECIMAL(10,7),
    "centroidLongitude" DECIMAL(10,7),
    "ownerRepresentative" VARCHAR(255),
    "publicRegistryNumber" VARCHAR(120),
    "publicRegistryDate" TIMESTAMP(3),
    "address" TEXT,
    "lastInfoDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForestPatrimonyLevel2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForestPatrimonyNeighbor" (
    "id" UUID NOT NULL,
    "level2Id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForestPatrimonyNeighbor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForestPatrimonyLevel3" (
    "id" UUID NOT NULL,
    "level2Id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "PatrimonyLevel3Type" NOT NULL,
    "totalAreaHa" DECIMAL(12,2) NOT NULL,
    "centroidLatitude" DECIMAL(10,7),
    "centroidLongitude" DECIMAL(10,7),
    "lastInfoDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForestPatrimonyLevel3_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForestPatrimonyLevel4" (
    "id" UUID NOT NULL,
    "level3Id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "PatrimonyLevel4Type" NOT NULL,
    "totalAreaHa" DECIMAL(12,2) NOT NULL,
    "plantableAreaHa" DECIMAL(12,2),
    "rotationPhase" VARCHAR(120),
    "previousUse" VARCHAR(255),
    "centroidLatitude" DECIMAL(10,7),
    "centroidLongitude" DECIMAL(10,7),
    "lastInfoDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForestPatrimonyLevel4_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForestPatrimonyLevel5" (
    "id" UUID NOT NULL,
    "level4Id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "PatrimonyLevel5Type" NOT NULL,
    "shapeType" "PlotShapeType" NOT NULL,
    "dimension1M" DECIMAL(12,4),
    "dimension2M" DECIMAL(12,4),
    "dimension3M" DECIMAL(12,4),
    "dimension4M" DECIMAL(12,4),
    "areaM2" DECIMAL(12,4) NOT NULL,
    "centroidLatitude" DECIMAL(10,7),
    "centroidLongitude" DECIMAL(10,7),
    "lastInfoDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForestPatrimonyLevel5_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forest_biological_asset_level6" (
    "id" UUID NOT NULL,
    "level4_id" UUID NOT NULL,
    "biological_asset_key" VARCHAR(220) NOT NULL,
    "accounting_key" VARCHAR(220),
    "establishment_date" TIMESTAMP(3),
    "planting_year" INTEGER,
    "genetic_material_code" VARCHAR(80),
    "genetic_material_name" VARCHAR(255),
    "asset_type" "biological_asset_type" NOT NULL DEFAULT 'COMERCIAL',
    "management_scheme_code" VARCHAR(80),
    "management_scheme_name" VARCHAR(255),
    "inventory_code" VARCHAR(80),
    "inventory_type" VARCHAR(120),
    "inventory_date" TIMESTAMP(3),
    "inventory_age_years" INTEGER,
    "level5_unit_count" INTEGER,
    "spacing_code" VARCHAR(80),
    "spacing_description" VARCHAR(255),
    "spacing_between_rows_m" DECIMAL(12,4),
    "spacing_between_trees_m" DECIMAL(12,4),
    "tree_density_per_ha" DECIMAL(12,0),
    "survival_rate" DECIMAL(5,2),
    "dominant_height_m" DECIMAL(12,4),
    "mean_height_m" DECIMAL(12,4),
    "quadratic_diameter_m" DECIMAL(12,4),
    "basal_area_m2" DECIMAL(12,4),
    "unit_volume_m3_no_bark_per_ha" DECIMAL(12,4),
    "unit_volume_m3_with_bark_per_ha" DECIMAL(12,4),
    "total_volume_m3_no_bark" DECIMAL(12,4),
    "total_volume_m3_with_bark" DECIMAL(12,4),
    "adjusted_volume_m3_no_bark_per_ha" DECIMAL(12,4),
    "adjusted_volume_m3_with_bark_per_ha" DECIMAL(12,4),
    "ima_class_code" VARCHAR(80),
    "ima_class_name" VARCHAR(120),
    "actual_cost_usd" DECIMAL(18,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forest_biological_asset_level6_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementScheme" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "ManagementScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForestInventoryTypeCatalog" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "ForestInventoryTypeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImaClass" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "classification" "ImaClassification" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "rangeMin" DECIMAL(12,4),
    "rangeMax" DECIMAL(12,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "ImaClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Continent" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Continent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" UUID NOT NULL,
    "continentId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "flagUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateDepartment" (
    "id" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StateDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MunicipalityDistrict" (
    "id" UUID NOT NULL,
    "stateId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MunicipalityDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" UUID NOT NULL,
    "municipalityId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityTerritory" (
    "id" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "CommunityType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityTerritory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "scientificName" VARCHAR(255) NOT NULL,
    "commonName" VARCHAR(255),
    "genus" VARCHAR(120),
    "family" VARCHAR(120),
    "taxonomicOrder" VARCHAR(120),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provenance" (
    "id" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "Provenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VegetalMaterial" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "speciesId" UUID NOT NULL,
    "materialType" "VegetalMaterialType" NOT NULL,
    "plantType" "PlantType" NOT NULL,
    "plantOrigin" "PlantOrigin" NOT NULL,
    "provenanceId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "VegetalMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandUseType" (
    "id" UUID NOT NULL,
    "continentId" UUID,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "isProductive" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "LandUseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spacing" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255),
    "betweenRowsM" DECIMAL(12,4),
    "betweenTreesM" DECIMAL(12,4),
    "treeDensityPerHa" DECIMAL(12,0),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "Spacing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantationDirection" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantationDirection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingDocument" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "documentNumber" VARCHAR(80) NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "bookValueUsd" DECIMAL(18,2) NOT NULL,
    "bookValuePerHaUsd" DECIMAL(18,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level4AdministrativeCost" (
    "id" UUID NOT NULL,
    "level4Id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "plantationAreaHa" DECIMAL(12,2) NOT NULL,
    "rotationPhase" VARCHAR(120),
    "accountingDocumentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level4AdministrativeCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "minLengthM" DECIMAL(12,4),
    "maxLengthM" DECIMAL(12,4),
    "minSmallEndDiameterCm" DECIMAL(12,4),
    "maxSmallEndDiameterCm" DECIMAL(12,4),
    "recommendedHarvestType" "RecommendedHarvestType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" UUID,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_slug_key" ON "Role"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Module_name_key" ON "Module"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Module_slug_key" ON "Module"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_moduleId_action_key" ON "Permission"("moduleId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_notificationType_channel_key" ON "NotificationPreference"("userId", "notificationType", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfiguration_organizationId_category_key_key" ON "SystemConfiguration"("organizationId", "category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardWidget_slug_key" ON "DashboardWidget"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserDashboardLayout_userId_widgetId_key" ON "UserDashboardLayout"("userId", "widgetId");

-- CreateIndex
CREATE UNIQUE INDEX "ForestPatrimonyLevel2_code_key" ON "ForestPatrimonyLevel2"("code");

-- CreateIndex
CREATE INDEX "ForestPatrimonyLevel2_organizationId_idx" ON "ForestPatrimonyLevel2"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ForestPatrimonyNeighbor_level2Id_code_key" ON "ForestPatrimonyNeighbor"("level2Id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ForestPatrimonyLevel3_level2Id_code_key" ON "ForestPatrimonyLevel3"("level2Id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ForestPatrimonyLevel4_level3Id_code_key" ON "ForestPatrimonyLevel4"("level3Id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ForestPatrimonyLevel5_level4Id_code_key" ON "ForestPatrimonyLevel5"("level4Id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_forest_bio_asset_l6_biological_asset_key" ON "forest_biological_asset_level6"("biological_asset_key");

-- CreateIndex
CREATE INDEX "idx_forest_bio_asset_l6_level4_created_at" ON "forest_biological_asset_level6"("level4_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementScheme_organizationId_code_key" ON "ManagementScheme"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ForestInventoryTypeCatalog_organizationId_code_key" ON "ForestInventoryTypeCatalog"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ImaClass_organizationId_code_key" ON "ImaClass"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Continent_code_key" ON "Continent"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Country_continentId_code_key" ON "Country"("continentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Region_countryId_code_key" ON "Region"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "StateDepartment_countryId_code_key" ON "StateDepartment"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalityDistrict_stateId_code_key" ON "MunicipalityDistrict"("stateId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "City_municipalityId_code_key" ON "City"("municipalityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityTerritory_cityId_code_key" ON "CommunityTerritory"("cityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Species_organizationId_code_key" ON "Species"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Provenance_countryId_code_key" ON "Provenance"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Provenance_organizationId_code_key" ON "Provenance"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "VegetalMaterial_organizationId_code_key" ON "VegetalMaterial"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LandUseType_organizationId_code_key" ON "LandUseType"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Spacing_organizationId_code_key" ON "Spacing"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PlantationDirection_code_key" ON "PlantationDirection"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_code_key" ON "AccountingDocument"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Level4AdministrativeCost_level4Id_code_key" ON "Level4AdministrativeCost"("level4Id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_organizationId_code_key" ON "ProductType"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfiguration" ADD CONSTRAINT "SystemConfiguration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDashboardLayout" ADD CONSTRAINT "UserDashboardLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDashboardLayout" ADD CONSTRAINT "UserDashboardLayout_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "DashboardWidget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForestPatrimonyLevel2" ADD CONSTRAINT "ForestPatrimonyLevel2_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForestPatrimonyNeighbor" ADD CONSTRAINT "ForestPatrimonyNeighbor_level2Id_fkey" FOREIGN KEY ("level2Id") REFERENCES "ForestPatrimonyLevel2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForestPatrimonyLevel3" ADD CONSTRAINT "ForestPatrimonyLevel3_level2Id_fkey" FOREIGN KEY ("level2Id") REFERENCES "ForestPatrimonyLevel2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForestPatrimonyLevel4" ADD CONSTRAINT "ForestPatrimonyLevel4_level3Id_fkey" FOREIGN KEY ("level3Id") REFERENCES "ForestPatrimonyLevel3"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForestPatrimonyLevel5" ADD CONSTRAINT "ForestPatrimonyLevel5_level4Id_fkey" FOREIGN KEY ("level4Id") REFERENCES "ForestPatrimonyLevel4"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forest_biological_asset_level6" ADD CONSTRAINT "fk_forest_bio_asset_l6_level4" FOREIGN KEY ("level4_id") REFERENCES "ForestPatrimonyLevel4"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementScheme" ADD CONSTRAINT "ManagementScheme_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForestInventoryTypeCatalog" ADD CONSTRAINT "ForestInventoryTypeCatalog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImaClass" ADD CONSTRAINT "ImaClass_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Country" ADD CONSTRAINT "Country_continentId_fkey" FOREIGN KEY ("continentId") REFERENCES "Continent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateDepartment" ADD CONSTRAINT "StateDepartment_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MunicipalityDistrict" ADD CONSTRAINT "MunicipalityDistrict_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "StateDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "MunicipalityDistrict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityTerritory" ADD CONSTRAINT "CommunityTerritory_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Species" ADD CONSTRAINT "Species_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provenance" ADD CONSTRAINT "Provenance_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provenance" ADD CONSTRAINT "Provenance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VegetalMaterial" ADD CONSTRAINT "VegetalMaterial_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VegetalMaterial" ADD CONSTRAINT "VegetalMaterial_provenanceId_fkey" FOREIGN KEY ("provenanceId") REFERENCES "Provenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VegetalMaterial" ADD CONSTRAINT "VegetalMaterial_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandUseType" ADD CONSTRAINT "LandUseType_continentId_fkey" FOREIGN KEY ("continentId") REFERENCES "Continent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandUseType" ADD CONSTRAINT "LandUseType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spacing" ADD CONSTRAINT "Spacing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level4AdministrativeCost" ADD CONSTRAINT "Level4AdministrativeCost_level4Id_fkey" FOREIGN KEY ("level4Id") REFERENCES "ForestPatrimonyLevel4"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level4AdministrativeCost" ADD CONSTRAINT "Level4AdministrativeCost_accountingDocumentId_fkey" FOREIGN KEY ("accountingDocumentId") REFERENCES "AccountingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

