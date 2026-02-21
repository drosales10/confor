# Agente API CRUD

## Objetivo
Implementar endpoint `route.ts` para entidad con operaciones:
- `GET` listado paginado + filtros
- `POST` creación
- `PATCH` actualización parcial
- `DELETE` eliminación controlada

## Ubicación
- `src/app/api/<ruta>/route.ts`

## Reglas obligatorias
- Autenticación: `requireAuth()`
- Permisos: `requirePermission(session.user.permissions, moduleSlug, action)`
- Excepción por rol: `SUPER_ADMIN` bypass para `GET/POST/PATCH/DELETE`
- En `GET`, permitir lectura si existe `READ` **o** cualquier permiso de escritura (`CREATE/UPDATE/DELETE`) del mismo módulo
- Respuesta: `ok(...)` / `fail(...)`
- Auditoría: `prisma.auditLog.create(...)` en `CREATE/UPDATE/DELETE`

### Plantilla de validación de permisos (reusable)
```ts
import { hasPermission } from "@/lib/permissions";

const isSuperAdmin = authResult.session.user.roles?.includes("SUPER_ADMIN");
if (!isSuperAdmin) {
  const permissions = authResult.session.user.permissions ?? [];
  const canRead = hasPermission(permissions, moduleSlug, "READ");
  const canWrite = ["CREATE", "UPDATE", "DELETE"].some((action) =>
    hasPermission(permissions, moduleSlug, action),
  );

  if (!canRead && !canWrite) {
    const permissionError = requirePermission(permissions, moduleSlug, "READ");
    if (permissionError) return permissionError;
  }
}
```

## GET
- Recibir `page`, `limit`, `search` y filtros adicionales.
- Retornar:
  - `items`
  - `pagination: { total, page, limit, totalPages }`

## PATCH
- Validar payload con Zod.
- Soportar actualización parcial.
- En entidades derivadas (ej. áreas calculadas), recalcular campos derivados antes de guardar.

## DELETE
- Verificar dependencias hijas antes de eliminar (si aplica).
- En conflictos, responder `409` con mensaje claro.

## Checklist final
- [ ] Manejo de errores consistente
- [ ] include/select solo cuando aporte al listado
- [ ] no filtrar datos sensibles innecesarios
- [ ] patrón de permisos reusable aplicado (SUPER_ADMIN + read/write fallback en GET)
- [ ] build y typecheck en verde
