-- DropForeignKey
ALTER TABLE "forest_geometry_n4" DROP CONSTRAINT "fk_forest_geometry_n4_import_job";

-- DropForeignKey
ALTER TABLE "forest_geometry_n4" DROP CONSTRAINT "fk_forest_geometry_n4_level2";

-- DropForeignKey
ALTER TABLE "forest_geometry_n4" DROP CONSTRAINT "fk_forest_geometry_n4_level3";

-- DropForeignKey
ALTER TABLE "forest_geometry_n4" DROP CONSTRAINT "fk_forest_geometry_n4_level4";

-- DropForeignKey
ALTER TABLE "forest_geometry_n4" DROP CONSTRAINT "fk_forest_geometry_n4_org";

-- DropForeignKey
ALTER TABLE "forest_geometry_recalc_jobs" DROP CONSTRAINT "fk_forest_geometry_recalc_level4";

-- DropForeignKey
ALTER TABLE "forest_geometry_recalc_jobs" DROP CONSTRAINT "fk_forest_geometry_recalc_org";

-- DropForeignKey
ALTER TABLE "geo_import_job_items" DROP CONSTRAINT "fk_geo_import_job_items_job";

-- DropIndex
DROP INDEX "idx_forest_geom_gist";

-- AlterTable
ALTER TABLE "forest_geometry_n4" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "valid_from" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "valid_to" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "forest_geometry_recalc_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "run_after" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "geo_import_job_items" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "geo_import_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "forest_geometry_n4" ADD CONSTRAINT "forest_geometry_n4_level4_id_fkey" FOREIGN KEY ("level4_id") REFERENCES "ForestPatrimonyLevel4"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forest_geometry_n4" ADD CONSTRAINT "forest_geometry_n4_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "geo_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_import_job_items" ADD CONSTRAINT "geo_import_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "geo_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forest_geometry_recalc_jobs" ADD CONSTRAINT "forest_geometry_recalc_jobs_level4_id_fkey" FOREIGN KEY ("level4_id") REFERENCES "ForestPatrimonyLevel4"("id") ON DELETE CASCADE ON UPDATE CASCADE;
