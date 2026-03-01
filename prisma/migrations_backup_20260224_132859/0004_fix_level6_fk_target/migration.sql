DO $$
BEGIN
  IF to_regclass('public.forest_biological_asset_level6') IS NULL THEN
    RAISE NOTICE 'Tabla forest_biological_asset_level6 no existe, se omite ajuste de FK';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_forest_bio_asset_l6_level4'
      AND conrelid = 'public.forest_biological_asset_level6'::regclass
  ) THEN
    ALTER TABLE public.forest_biological_asset_level6
      DROP CONSTRAINT fk_forest_bio_asset_l6_level4;
  END IF;

  IF to_regclass('public."ForestPatrimonyLevel4"') IS NOT NULL THEN
    ALTER TABLE public.forest_biological_asset_level6
      ADD CONSTRAINT fk_forest_bio_asset_l6_level4
      FOREIGN KEY (level4_id) REFERENCES public."ForestPatrimonyLevel4"(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  ELSIF to_regclass('public.forest_patrimony_level4') IS NOT NULL THEN
    ALTER TABLE public.forest_biological_asset_level6
      ADD CONSTRAINT fk_forest_bio_asset_l6_level4
      FOREIGN KEY (level4_id) REFERENCES public.forest_patrimony_level4(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  ELSE
    RAISE EXCEPTION 'No existe tabla padre para FK de nivel 6';
  END IF;
END;
$$;
