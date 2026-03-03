# Anexo Técnico FASE 8 - Capa Geoespacial Nivel 4

## 1. Objetivo

Procesar shapefiles de rodales (Nivel 4), convertirlos a objetos PostGIS, validar integridad jerárquica (Nivel 2 + Nivel 3 + Nivel 4), derivar superficie oficial en hectáreas y actualizar centroides para consultas espaciales.

## 2. Arquitectura implementada

- Base de datos: PostgreSQL + PostGIS.
- Tabla espacial versionada: `forest_geometry_n4`.
- Jobs de importación: `geo_import_jobs`, `geo_import_job_items`.
- Jobs de recálculo post-guardado: `forest_geometry_recalc_jobs`.
- API carga: `POST /api/forest/geo/import`.
- API estado: `GET /api/forest/geo/import/[jobId]`.
- API worker runner: `POST /api/forest/geo/import/worker`.
- API consulta de capa por ventana de mapa: `GET /api/forest/geo/layers/nivel4?bbox=minLon,minLat,maxLon,maxLat`.
- UI principal: `/dashboard` con mapa y botón de carga `.zip`.
- Scheduler automático: proceso `pnpm worker:geo` (`src/workers/geo-worker-scheduler.ts`) con polling de jobs pendientes.

## 3. Especificación de Base de Datos

### 3.1 Tabla espacial de patrimonio (`forest_geometry_n4`)

- Llaves jerárquicas: `organization_id`, `level2_id`, `level3_id`, `level4_id`.
- Geometría: `geom geometry(MultiPolygon, 4326)`.
- Derivados: `centroid geometry(Point, 4326)`, `superficie_ha numeric(12,4)`.
- Trazabilidad: `valid_from`, `valid_to`, `is_active`, `import_job_id`.
- Regla activa: índice único parcial para una sola versión activa por `organization_id + level4_id`.

### 3.2 Índices críticos

- `GIST (geom)` para consultas espaciales rápidas (BBOX).
- Índice jerárquico compuesto por organización/nivel2/nivel3.
- Índice por `level4_id + is_active`.

### 3.3 Trigger de métricas automáticas

- Función: `fn_calculate_forest_metrics()`.
- Ejecuta en `BEFORE INSERT OR UPDATE OF geom`.
- Acciones:
  - Normaliza geometría: `ST_Multi(ST_MakeValid(geom))`.
  - Calcula centroide operativo: `ST_PointOnSurface(geom)`.
  - Calcula superficie oficial:

$$
\text{superficie\_ha} = \frac{ST\_Area(geom::geography)}{10000}
$$

## 4. Máquina de estados del Worker de Importación

Módulo: `import-level4-shapes-worker`

### 4.1 Estados de `geo_import_jobs`

- `PENDING`: archivo recibido y job creado.
- `EXTRACTING`: descompresión y validación de archivos mínimos.
- `VALIDATING`: validación de estructura y geometría inicial.
- `PROCESSING`: cruce jerárquico, inserción espacial y cálculo de métricas.
- `COMPLETED`: lote finalizado con éxito (puede incluir registros fallidos parciales).
- `FAILED`: error fatal del job (rollback del alcance transaccional correspondiente).

### 4.2 Flujo lógico resumido

1. Validar ZIP con `.shp`, `.shx`, `.dbf`, `.prj`.
2. Parsear features.
3. Extraer campos de jerarquía (`nivel2`, `nivel3`, `nivel4`) desde atributos.
4. Validar geometría Polygon/MultiPolygon.
5. Resolver `level4` por jerarquía y organización.
6. Desactivar geometría activa previa (versionado temporal).
7. Insertar nueva geometría activa en `forest_geometry_n4`.
8. Sincronizar `ForestPatrimonyLevel4.totalAreaHa` y centroides.
9. Registrar resultado por feature en `geo_import_job_items`.

## 5. Worker de recálculo post-guardado Nivel 4

- Cola: `forest_geometry_recalc_jobs`.
- Se encola al crear/actualizar Nivel 4 en API patrimonial.
- Procesa una tarea pendiente y recalcula:
  - `totalAreaHa`
  - `centroidLatitude`
  - `centroidLongitude`
- Si no existe geometría activa para el rodal, marca el recálculo como `FAILED` con mensaje de trazabilidad.

## 6. Reglas de seguridad multiorganización

- Todas las consultas del worker y de capa espacial filtran por `organization_id`.
- Un usuario solo puede cargar/consultar su organización, salvo `SUPER_ADMIN`.
- El cruce jerárquico se valida dentro de la organización activa para evitar polígonos huérfanos o cruzados.

## 7. API de consulta para mapa (BBOX)

Contrato:

`GET /api/forest/geo/layers/nivel4?bbox={min_lon,min_lat,max_lon,max_lat}`

- Filtra por `organization_id`, `is_active = true` y `geom && ST_MakeEnvelope(...)`.
- Responde como `FeatureCollection` para render incremental en el visor.

## 8. Manejo de errores y trazabilidad

Errores registrados por feature (`geo_import_job_items`):

- Jerarquía no encontrada en Nivel 2/3/4.
- Geometría inválida o tipo no soportado.
- Falla de inserción/actualización de capa espacial.

Error de job (`geo_import_jobs.error_message`):

- ZIP incompleto.
- Shapefile sin features.
- Falla técnica fatal del worker.

## 9. Consideraciones operativas

- El scheduler automático corre como proceso dedicado con `pnpm worker:geo` y atiende jobs pendientes de importación y recálculo.
- El endpoint `POST /api/forest/geo/import/worker` se mantiene para ejecución manual/forzada o integración externa.
- En la UI principal se muestra estado de job y conteo procesado/fallido en tiempo real por polling.
- El modelo actual prioriza exactitud y trazabilidad sobre reemplazo destructivo de geometrías.
