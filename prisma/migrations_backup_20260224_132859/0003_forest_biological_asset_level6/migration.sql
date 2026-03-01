DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'biological_asset_type') THEN
    CREATE TYPE biological_asset_type AS ENUM ('COMERCIAL', 'INVESTIGACION');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS forest_biological_asset_level6 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level4_id UUID NOT NULL,
  biological_asset_key VARCHAR(220) NOT NULL,
  accounting_key VARCHAR(220),
  establishment_date TIMESTAMP(3),
  planting_year INTEGER,
  genetic_material_code VARCHAR(80),
  genetic_material_name VARCHAR(255),
  asset_type biological_asset_type NOT NULL DEFAULT 'COMERCIAL',
  management_scheme_code VARCHAR(80),
  management_scheme_name VARCHAR(255),
  inventory_code VARCHAR(80),
  inventory_type VARCHAR(120),
  inventory_date TIMESTAMP(3),
  inventory_age_years INTEGER,
  level5_unit_count INTEGER,
  spacing_code VARCHAR(80),
  spacing_description VARCHAR(255),
  spacing_between_rows_m NUMERIC(12,4),
  spacing_between_trees_m NUMERIC(12,4),
  tree_density_per_ha NUMERIC(12,0),
  survival_rate NUMERIC(5,2),
  dominant_height_m NUMERIC(12,4),
  mean_height_m NUMERIC(12,4),
  quadratic_diameter_m NUMERIC(12,4),
  basal_area_m2 NUMERIC(12,4),
  unit_volume_m3_no_bark_per_ha NUMERIC(12,4),
  unit_volume_m3_with_bark_per_ha NUMERIC(12,4),
  total_volume_m3_no_bark NUMERIC(12,4),
  total_volume_m3_with_bark NUMERIC(12,4),
  adjusted_volume_m3_no_bark_per_ha NUMERIC(12,4),
  adjusted_volume_m3_with_bark_per_ha NUMERIC(12,4),
  ima_class_code VARCHAR(80),
  ima_class_name VARCHAR(120),
  actual_cost_usd NUMERIC(18,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forest_bio_asset_l6_level4
    FOREIGN KEY (level4_id) REFERENCES forest_patrimony_level4(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_forest_bio_asset_l6_biological_asset_key UNIQUE (biological_asset_key)
);

CREATE INDEX IF NOT EXISTS idx_forest_bio_asset_l6_level4_created_at
  ON forest_biological_asset_level6 (level4_id, created_at DESC);

DO $$
BEGIN
  IF to_regclass('forest_biological_asset_level6') IS NOT NULL AND to_regproc('update_updated_at_column') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_forest_biological_asset_level6_updated_at ON forest_biological_asset_level6';
    EXECUTE 'CREATE TRIGGER trigger_update_forest_biological_asset_level6_updated_at BEFORE UPDATE ON forest_biological_asset_level6 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END;
$$;
