# Agente de Validaciones Zod

## Objetivo
Crear esquemas Zod reutilizables para una entidad con soporte para:
- Create
- Update parcial
- Delete
- Query paginada con filtros (`search`, `page`, `limit`, `parentId` opcional)

## Convenciones del proyecto
- Ubicación: `src/validations/<entidad>.schema.ts`
- Reusar `paginationSchema` y `uuidSchema` desde `src/validations/common.schema`
- Para update, exigir al menos 1 campo con `.refine(...)`
- Usar `z.discriminatedUnion` cuando aplique por niveles/tipos

## Plantilla base
1. `create<Entity>Schema`
2. `update<Entity>Schema`
3. `delete<Entity>Schema`
4. `get<Entity>QuerySchema`

## Checklist
- [ ] Tipos numéricos con `z.coerce.number()`
- [ ] Fechas con `z.coerce.date()` (si aplica)
- [ ] enums alineados con Prisma
- [ ] límites de longitud consistentes (`min/max`)
- [ ] mensajes de validación claros
