# Agente Compatibilidad Encabezados Import/Export

## Objetivo
Eliminar errores de carga masiva causados por diferencias entre encabezados de exportación (usualmente en español) y encabezados esperados por importación (usualmente técnicos en inglés), sin romper archivos históricos.

## Estrategia recomendada
- Mantener exportaciones legibles para negocio (ES) y compatibilidad actual.
- Hacer imports tolerantes: aceptar encabezados ES/EN + variantes con tildes/espacios/guiones.
- Estandarizar mapeo de columnas por entidad y validar con pruebas de round-trip.

## Reglas obligatorias
1. No cambiar contratos API de negocio si no es necesario.
2. No eliminar encabezados actuales de exportación.
3. Import debe aceptar, como mínimo:
   - Encabezados del CSV exportado
   - Encabezados del Excel exportado
   - Encabezados técnicos históricos (camel/snake)
4. Normalización de encabezados obligatoria:
   - trim
   - lower-case
   - remover tildes
   - remover espacios, `_` y `-`
5. Si hay FKs, resolver por ID y por código/nombre.
6. Si no se puede resolver FK, reportar fila exacta con mensaje claro.

## Patrón técnico reutilizable
### 1) Normalización
```ts
function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}
```

### 2) Alias por campo
Definir sinónimos por cada campo de importación. Ejemplo:
```ts
name: ["name", "nombre"]
countryRef: ["countryid", "country", "countryname", "pais", "país"]
isActive: ["isactive", "activo"]
```

### 3) Getter por alias
```ts
const get = (...targets: string[]) => {
  for (const target of targets) {
    const normalizedTarget = normalizeHeader(target);
    const matchKey = Object.keys(record).find((key) => normalizeHeader(key) === normalizedTarget);
    if (matchKey) return String(record[matchKey] ?? "").trim();
  }
  return "";
};
```

### 4) Resolución FK robusta
- Si viene UUID válido: usarlo.
- Si no: buscar por código.
- Si no: buscar por nombre normalizado.
- Si no existe: error por fila y `skipped++`.

## Plan de ejecución por lotes
### Lote 1 (General Config base)
- `continents`
- `countries`
- `regions`
- `state-departments`

### Lote 2 (General Config extendido)
- `municipality-districts`
- `cities`
- `community-territories`

### Lote 3 (Core seguridad)
- `organizations`
- `roles`
- `users`

### Lote 4 (Forest Config)
- `ima-classes`
- `inventory-types`
- `land-use-types`
- `management-schemes`
- `product-types`
- `provenances`
- `spacings`
- `species`
- `vegetal-materials`
- `level4-costs`

### Lote 5 (Forest transaccional)
- `forest/patrimony`
- `forest/biological-assets`

## Criterios de aceptación por endpoint
- [ ] Import CSV acepta encabezados del export CSV
- [ ] Import XLSX acepta encabezados del export XLSX
- [ ] Import acepta encabezados técnicos históricos
- [ ] Si hay FK, resuelve por ID/código/nombre
- [ ] Error reporta fila + causa clara
- [ ] Lint del archivo modificado en verde

## Prueba mínima obligatoria (round-trip)
1. Exportar CSV y XLSX desde el endpoint.
2. Reimportar ambos archivos sin editar.
3. Verificar resultado: `created/updated/skipped/errors` coherente.
4. Confirmar que `errors.length === 0` para datos válidos.

## Prompt reusable
```txt
Ejecuta el agente "07-import-export-header-compat-agent" sobre el lote <N>.

Objetivo:
- Corregir todos los endpoints import del lote para aceptar encabezados ES/EN y los encabezados exactos del export.
- Mantener export legible (no romper encabezados actuales).
- Implementar resolución robusta de FKs por ID/código/nombre.

Restricciones:
- No cambiar comportamiento funcional fuera de import/export.
- Aplicar cambios mínimos por endpoint.
- Validar con lint por archivo modificado y prueba round-trip.

Entrega:
- Lista de archivos tocados.
- Resumen por endpoint (qué alias se agregaron y qué FK se resolvió).
- Riesgos o pendientes detectados.
```
