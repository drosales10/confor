# Agente UI Tabla (Import/Export + Ordenación)

## Objetivo
Replicar en cualquier vista de tabla del dashboard el patrón de `users/page.tsx` para:
- Importar registros (`Importar`) con todos sus campo
- Exportar CSV (`Exportar CSV`) con todos sus campos
- Exportar Excel (`Exportar Excel`) con todos sus campos
- Ordenar todos los campos visibles en orden ascendente y descendente

## Referencia base
- Vista modelo: `src/app/(dashboard)/users/page.tsx`
- Componentes reutilizables: `TableToolbar`, `TablePagination`, `SortableHeader`

## Ubicación esperada
- UI: `src/app/(dashboard)/<modulo>/page.tsx`
- API listado: `src/app/api/<ruta>/route.ts`
- API export: `src/app/api/<ruta>/export/route.ts`
- API import: `src/app/api/<ruta>/import/route.ts`

## Entradas requeridas para ejecutar el agente
- `moduleTitle`: título visible de la pantalla
- `moduleSlug`: ruta dashboard (ej. `users`, `roles`, `organizations`)
- `apiBasePath`: ruta API base (ej. `/api/users`)
- `rowType`: shape tipada de la fila en UI
- `columns`: arreglo con columnas y su clave de orden
- `searchPlaceholder`: placeholder del buscador
- `permissionsMap`: permisos para `READ`, `CREATE`, `UPDATE`, `DELETE`, `EXPORT`, `IMPORT`
- `defaultPageSize`: límite inicial (recomendado: `25`)
- `exportLimitDefault`: límite de exportación (recomendado: `100`)

## Patrón obligatorio
1. **Búsqueda + paginación + límite**
   - Mantener `search`, `debouncedSearch`, `page`, `limit`, `pagination`.
   - Resetear `page=1` al cambiar búsqueda o límite.

2. **Ordenación asc/desc en todos los campos visibles**
   - Definir `SortKey` con todas las columnas ordenables en UI.
   - Definir `serverSortableKeys` para columnas soportadas por API.
   - Para columnas no soportadas por backend, ordenar en cliente con `useMemo` sobre `users/items`.
   - `toggleSort` debe ser determinístico:
     - nueva columna => `asc`
     - misma columna => alternar `asc`/`desc`
   - Nunca anidar `setSortOrder` dentro de `setSortBy`.

3. **Importar**
   - Input tipo archivo oculto y botón `Importar`.
   - Aceptar `.csv,.xlsx`.
   - Enviar `FormData` a `POST <apiBasePath>/import`.
   - Limpiar input al finalizar.
   - Notificar resultados y errores con `sileo`.

4. **Exportar CSV/Excel**
   - Botones `Exportar CSV` y `Exportar Excel`.
   - Consumir `GET <apiBasePath>/export?format=csv|xlsx` y respetar filtros/orden actuales.
   - Descargar blob con nombre desde `content-disposition`.
   - Notificar éxito/error con `sileo`.

5. **Integración de toolbar/paginación**
   - Usar `TableToolbar` con `search`, `limit`, `exportLimit`, `total`.
   - Usar `TablePagination` con `page`, `totalPages`, `total`.

6. **Permisos**
   - Mostrar/ocultar acciones según `permissionsMap`.
   - `Importar` y botones de alta sólo con `CREATE`/`ADMIN`.
   - `Exportar` sólo con `EXPORT`/`ADMIN`.

## Criterios de aceptación
- [ ] Todas las columnas configuradas alternan asc/desc correctamente.
- [ ] No hay doble carga innecesaria al ordenar o buscar.
- [ ] Importación CSV/XLSX funcional con feedback claro.
- [ ] Exportación CSV/XLSX descarga archivo correcto.
- [ ] Sin errores de TypeScript/ESLint en la vista.

## Prompt reusable para invocar este agente
Usa este prompt en Copilot para aplicar el patrón en otra vista:

```txt
Ejecuta el agente "06-ui-tabla-import-export-sort-agent" en este repo y construye/actualiza la vista de tabla del módulo "<moduleSlug>" tomando como referencia exacta users/page.tsx.

Objetivo:
- Agregar objetos UI: Importar, Exportar CSV, Exportar Excel.
- Implementar ordenación de TODOS los campos visibles con toggle asc/desc estable.
- Mantener búsqueda con debounce, paginación y límite usando TableToolbar y TablePagination.

Datos del módulo:
- moduleTitle: <moduleTitle>
- moduleSlug: <moduleSlug>
- apiBasePath: <apiBasePath>
- searchPlaceholder: <searchPlaceholder>
- defaultPageSize: 25
- exportLimitDefault: 100

Columnas y orden:
- columns: <columns>
- serverSortableKeys: <serverSortableKeys>

Permisos:
- permissionsMap: <permissionsMap>

Restricciones técnicas obligatorias:
- Reusar SortableHeader.
- Si una columna no es sortable en backend, ordenar en cliente con useMemo.
- toggleSort determinístico: nueva columna asc; misma columna alterna asc/desc.
- No anidar setSortOrder dentro de setSortBy.
- Usar sileo para todos los mensajes.

Entrega:
- Modifica únicamente archivos del módulo objetivo.
- Deja validado sin errores de TypeScript/ESLint en la vista.
```
