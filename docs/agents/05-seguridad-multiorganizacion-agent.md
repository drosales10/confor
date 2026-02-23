# Agente Seguridad Multiorganización

## Objetivo
Aplicar de forma consistente el patrón de aislamiento multiorganización en cualquier módulo nuevo o existente, evitando acceso cruzado por `id` conocido entre organizaciones.

## Cuándo usar este agente
- Al crear un módulo CRUD nuevo.
- Al endurecer seguridad de módulos ya existentes.
- Antes de liberar funcionalidades que consultan o mutan datos con jerarquías (`parent -> child`).

## Input mínimo requerido
- `moduleSlug` (ej: `forest-biological-asset`)
- `apiRoute` (ej: `/api/forest/biological-assets`)
- `orgAnchorModel` (modelo donde vive `organizationId`, ej: `ForestPatrimonyLevel2`)
- `ownershipPath` (cadena relacional desde la entidad hasta organización, ej: `level4.level3.level2.organizationId`)
- `isSuperAdminBypass` (normalmente `true`)

## Flujo obligatorio
1. Identificar `organizationId` de sesión con fallback a BD si falta en token.
2. Definir bypass de `SUPER_ADMIN`.
3. En `GET`, filtrar por `organizationId` a través de la cadena relacional.
4. En `POST`, validar ownership del padre antes de crear.
5. En `PATCH`, validar ownership del registro objetivo antes de actualizar.
6. En `DELETE`, validar ownership del registro objetivo antes de eliminar.
7. Si usuario no `SUPER_ADMIN` y no tiene `organizationId`, responder `403`.

## Patrón reusable recomendado
```ts
async function resolveOrganizationId(sessionUser: { id?: string; organizationId?: string | null }) {
  if (sessionUser.organizationId !== undefined) return sessionUser.organizationId;
  if (!sessionUser.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { organizationId: true },
  });

  return user?.organizationId ?? null;
}
```

```ts
const organizationId = await resolveOrganizationId({
  id: authResult.session.user.id,
  organizationId: authResult.session.user.organizationId,
});

if (!isSuperAdmin && !organizationId) {
  return fail("El usuario no tiene una organización asociada", 403);
}
```

## Reglas de aceptación
- No existe consulta sin filtro multiorganización en `GET` para usuarios no `SUPER_ADMIN`.
- No existe operación `PATCH/DELETE` sin validación previa de ownership.
- No existe `POST` hijo sin validar que el padre pertenece a la organización.
- Respuestas de seguridad consistentes: `401`, `403`, `404`.

## Checklist QA
- Usuario A (Org A) no puede leer/editar/eliminar datos de Org B.
- Usuario A no puede crear hijos bajo padres de Org B.
- `SUPER_ADMIN` sí puede operar cross-org.
- `npm run lint`, `npx tsc --noEmit`, `npm run build` sin errores.

## Notas de implementación
- Reutilizar `requireAuth`, `requirePermission`, `ok/fail`.
- Mantener mensajes breves en español.
- No reemplaza control de permisos por módulo: lo complementa.
