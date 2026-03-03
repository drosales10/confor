CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TYPE "GeoImportJobStatus" AS ENUM ('PENDING', 'EXTRACTING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "GeoImportItemStatus" AS ENUM ('PROCESSED', 'FAILED');
CREATE TYPE "GeoRecalcJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS public.geo_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  status "GeoImportJobStatus" NOT NULL DEFAULT 'PENDING',
  file_name VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.geo_import_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  feature_index INTEGER NOT NULL,
  status "GeoImportItemStatus" NOT NULL,
  level2_code VARCHAR(80),
  level3_code VARCHAR(80),
  level4_code VARCHAR(80),
  message TEXT,
  raw_properties JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_geo_import_job_items_job FOREIGN KEY (job_id) REFERENCES public.geo_import_jobs (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.forest_geometry_n4 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  level2_id UUID NOT NULL,
  level3_id UUID NOT NULL,
  level4_id UUID NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  centroid geometry(Point, 4326),
  superficie_ha NUMERIC(12, 4) NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  import_job_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_forest_geometry_n4_org FOREIGN KEY (organization_id) REFERENCES public."Organization" (id) ON DELETE RESTRICT,
  CONSTRAINT fk_forest_geometry_n4_level2 FOREIGN KEY (level2_id) REFERENCES public."ForestPatrimonyLevel2" (id) ON DELETE RESTRICT,
  CONSTRAINT fk_forest_geometry_n4_level3 FOREIGN KEY (level3_id) REFERENCES public."ForestPatrimonyLevel3" (id) ON DELETE RESTRICT,
  CONSTRAINT fk_forest_geometry_n4_level4 FOREIGN KEY (level4_id) REFERENCES public."ForestPatrimonyLevel4" (id) ON DELETE RESTRICT,
  CONSTRAINT fk_forest_geometry_n4_import_job FOREIGN KEY (import_job_id) REFERENCES public.geo_import_jobs (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.forest_geometry_recalc_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  level4_id UUID NOT NULL,
  status "GeoRecalcJobStatus" NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_forest_geometry_recalc_org FOREIGN KEY (organization_id) REFERENCES public."Organization" (id) ON DELETE RESTRICT,
  CONSTRAINT fk_forest_geometry_recalc_level4 FOREIGN KEY (level4_id) REFERENCES public."ForestPatrimonyLevel4" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_geo_import_jobs_org_status ON public.geo_import_jobs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_geo_import_jobs_status_created ON public.geo_import_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS idx_geo_import_job_items_job_status ON public.geo_import_job_items (job_id, status);

CREATE INDEX IF NOT EXISTS idx_forest_geom_gist ON public.forest_geometry_n4 USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_forest_geometry_n4_hierarchy ON public.forest_geometry_n4 (organization_id, level2_id, level3_id);
CREATE INDEX IF NOT EXISTS idx_forest_geometry_n4_level4_active ON public.forest_geometry_n4 (level4_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_forest_geometry_n4_active ON public.forest_geometry_n4 (organization_id, level4_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_forest_geometry_recalc_jobs_status_run_after ON public.forest_geometry_recalc_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS idx_forest_geometry_recalc_jobs_org_level4 ON public.forest_geometry_recalc_jobs (organization_id, level4_id);

CREATE OR REPLACE FUNCTION public.fn_calculate_forest_metrics()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_Multi(ST_MakeValid(NEW.geom));
  NEW.centroid := ST_PointOnSurface(NEW.geom);
  NEW.superficie_ha := ST_Area(NEW.geom::geography) / 10000;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forest_metrics ON public.forest_geometry_n4;
CREATE TRIGGER trg_forest_metrics
BEFORE INSERT OR UPDATE OF geom
ON public.forest_geometry_n4
FOR EACH ROW
EXECUTE FUNCTION public.fn_calculate_forest_metrics();

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_geo_import_jobs_updated_at ON public.geo_import_jobs;
CREATE TRIGGER trg_geo_import_jobs_updated_at
BEFORE UPDATE ON public.geo_import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_forest_geometry_recalc_jobs_updated_at ON public.forest_geometry_recalc_jobs;
CREATE TRIGGER trg_forest_geometry_recalc_jobs_updated_at
BEFORE UPDATE ON public.forest_geometry_recalc_jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at();
