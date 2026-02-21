DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patrimony_level2_type') THEN
    CREATE TYPE patrimony_level2_type AS ENUM ('FINCA', 'PREDIO', 'HATO', 'FUNDO', 'HACIENDA','FARM', 'RANCHO', 'ESTANCIA', 'RESERVA', 'OTRO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_status') THEN
    CREATE TYPE legal_status AS ENUM ('ADQUISICION', 'ARRIENDO', 'USUFRUCTO', 'COMODATO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patrimony_level3_type') THEN
    CREATE TYPE patrimony_level3_type AS ENUM ('COMPARTIMIENTO', 'BLOCK', 'SECCION', 'LOTE', 'ZONA', 'BLOQUE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patrimony_level4_type') THEN
    CREATE TYPE patrimony_level4_type AS ENUM ('RODAL', 'PARCELA', 'ENUMERATION', 'UNIDAD_DE_MANEJO', 'STAND');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patrimony_level5_type') THEN
    CREATE TYPE patrimony_level5_type AS ENUM ('REFERENCIA', 'SUBUNIDAD', 'SUBPARCELA', 'MUESTRA', 'SUBMUESTRA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plot_shape_type') THEN
    CREATE TYPE plot_shape_type AS ENUM ('RECTANGULAR', 'CUADRADA', 'CIRCULAR', 'HEXAGONAL');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS forest_patrimony_level2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type patrimony_level2_type NOT NULL,
  legal_document_date TIMESTAMP(3),
  legal_status legal_status,
  total_area_ha NUMERIC(12,2) NOT NULL,
  centroid_latitude NUMERIC(10,7),
  centroid_longitude NUMERIC(10,7),
  owner_representative VARCHAR(255),
  public_registry_number VARCHAR(120),
  public_registry_date TIMESTAMP(3),
  address TEXT,
  last_info_date TIMESTAMP(3),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forest_patrimony_neighbor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level2_id UUID NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(80) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forest_neighbor_level2
    FOREIGN KEY (level2_id) REFERENCES forest_patrimony_level2(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS forest_patrimony_level3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level2_id UUID NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type patrimony_level3_type NOT NULL,
  total_area_ha NUMERIC(12,2) NOT NULL,
  centroid_latitude NUMERIC(10,7),
  centroid_longitude NUMERIC(10,7),
  last_info_date TIMESTAMP(3),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forest_level3_level2
    FOREIGN KEY (level2_id) REFERENCES forest_patrimony_level2(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS forest_patrimony_level4 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level3_id UUID NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type patrimony_level4_type NOT NULL,
  total_area_ha NUMERIC(12,2) NOT NULL,
  plantable_area_ha NUMERIC(12,2),
  rotation_phase VARCHAR(120),
  previous_use VARCHAR(255),
  centroid_latitude NUMERIC(10,7),
  centroid_longitude NUMERIC(10,7),
  last_info_date TIMESTAMP(3),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forest_level4_level3
    FOREIGN KEY (level3_id) REFERENCES forest_patrimony_level3(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS forest_patrimony_level5 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level4_id UUID NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type patrimony_level5_type NOT NULL,
  shape_type plot_shape_type NOT NULL,
  dimension1_m NUMERIC(12,4),
  dimension2_m NUMERIC(12,4),
  dimension3_m NUMERIC(12,4),
  dimension4_m NUMERIC(12,4),
  area_m2 NUMERIC(12,4) NOT NULL,
  centroid_latitude NUMERIC(10,7),
  centroid_longitude NUMERIC(10,7),
  last_info_date TIMESTAMP(3),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forest_level5_level4
    FOREIGN KEY (level4_id) REFERENCES forest_patrimony_level4(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_forest_level2_code ON forest_patrimony_level2 (code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_forest_neighbor_level2_code ON forest_patrimony_neighbor (level2_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_forest_level3_level2_code ON forest_patrimony_level3 (level2_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_forest_level4_level3_code ON forest_patrimony_level4 (level3_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_forest_level5_level4_code ON forest_patrimony_level5 (level4_id, code);

CREATE INDEX IF NOT EXISTS idx_forest_neighbor_level2_created_at ON forest_patrimony_neighbor (level2_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forest_level3_level2_created_at ON forest_patrimony_level3 (level2_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forest_level4_level3_created_at ON forest_patrimony_level4 (level3_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forest_level5_level4_created_at ON forest_patrimony_level5 (level4_id, created_at DESC);

DO $$
BEGIN
  IF to_regclass('forest_patrimony_level2') IS NOT NULL AND to_regproc('update_updated_at_column') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_forest_patrimony_level2_updated_at ON forest_patrimony_level2';
    EXECUTE 'CREATE TRIGGER trigger_update_forest_patrimony_level2_updated_at BEFORE UPDATE ON forest_patrimony_level2 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;

  IF to_regclass('forest_patrimony_level3') IS NOT NULL AND to_regproc('update_updated_at_column') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_forest_patrimony_level3_updated_at ON forest_patrimony_level3';
    EXECUTE 'CREATE TRIGGER trigger_update_forest_patrimony_level3_updated_at BEFORE UPDATE ON forest_patrimony_level3 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;

  IF to_regclass('forest_patrimony_level4') IS NOT NULL AND to_regproc('update_updated_at_column') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_forest_patrimony_level4_updated_at ON forest_patrimony_level4';
    EXECUTE 'CREATE TRIGGER trigger_update_forest_patrimony_level4_updated_at BEFORE UPDATE ON forest_patrimony_level4 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;

  IF to_regclass('forest_patrimony_level5') IS NOT NULL AND to_regproc('update_updated_at_column') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_forest_patrimony_level5_updated_at ON forest_patrimony_level5';
    EXECUTE 'CREATE TRIGGER trigger_update_forest_patrimony_level5_updated_at BEFORE UPDATE ON forest_patrimony_level5 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END;
$$;
