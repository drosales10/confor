# Agente Orquestador CRUD (Tablas nuevas)

## Objetivo
Implementar un módulo completo para una tabla nueva siguiendo el patrón ya aplicado en `patrimonio-forestal`:
- Formulario de creación
- Validación Zod
- API CRUD (`GET/POST/PATCH/DELETE`)
- Búsqueda/filtros
- Listado
- Paginación
- Edición inline

## Input mínimo requerido
- `entityName` (ej: `MaterialVegetal`)
- `moduleSlug` para permisos (ej: `material-vegetal`)
- `routeBase` (ej: `/material-vegetal`)
- `apiRoute` (ej: `/api/forest/material-vegetal`)
- `fields` con tipo, requerido, enum/opciones, límites

## Flujo obligatorio
1. Leer `prisma/schema.prisma` y confirmar el modelo objetivo.
2. Crear/actualizar validaciones en `src/validations/<entidad>.schema.ts`.
3. Implementar API en `src/app/api/.../route.ts` con:
   - `requireAuth`
   - `requirePermission`
   - bypass por rol `SUPER_ADMIN`
   - para `GET`: permitir acceso si el usuario tiene `READ` o cualquier permiso de escritura (`CREATE/UPDATE/DELETE`) del mismo `moduleSlug`
   - respuesta uniforme `ok/fail`
   - auditoría en `auditLog`
4. Aplicar seguridad multiorganización usando `docs/agents/05-seguridad-multiorganizacion-agent.md`.
5. Implementar UI en `src/app/(dashboard)/<ruta>/page.tsx` con:
   - formulario
   - búsqueda con `useDebounce`
   - paginación (page/limit)
   - total de resultados
   - edición inline + eliminación
6. Agregar entrada de navegación en `src/app/(dashboard)/layout.tsx` si aplica.
7. Validar con:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run build`

## Criterios de aceptación
- CRUD funcional end-to-end
- Seguridad multiorganización aplicada (filtro por organización + ownership checks)
- Sin errores de lint/types/build
- UX consistente con `patrimonio-forestal`
- Sin hardcode de permisos fuera de `moduleSlug`

## Restricciones
- No introducir nuevas librerías si no son necesarias.
- Mantener estilo del proyecto.
- Cambios mínimos, sin refactor masivo no solicitado.

## Patrón reusable (permisos)
Usar este patrón en todos los `GET` de módulos CRUD para evitar bloqueos de listado cuando el rol solo tiene permisos de escritura:

```ts
const isSuperAdmin = session.user.roles?.includes("SUPER_ADMIN");
if (!isSuperAdmin) {
   const permissions = session.user.permissions ?? [];
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
